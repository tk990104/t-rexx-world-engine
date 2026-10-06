import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import puppeteer from 'puppeteer';
import sharp from 'sharp';
import { closeOwnedBrowser } from './qa-owned-browser-cleanup.mjs';

let browser, page, report, phase = 'startup';
let expectDeleteConfirmation = false;
const started = Date.now(), errors = [], unexpected = [];
const mark = name => { phase = name; console.error(JSON.stringify({ phase, elapsedMs: Date.now() - started })); };
const watchdog = setTimeout(() => {
  console.error(JSON.stringify({ failed: '60-second watchdog', phase }));
  const owned = browser?.process();
  if (owned && owned.exitCode === null && owned.signalCode === null) owned.kill();
  process.exit(1);
}, 60000);
try {
  const base = new URL(process.env.QA_BASE_URL || 'http://127.0.0.1:5175');
  assert.ok(['127.0.0.1', 'localhost'].includes(base.hostname));
  browser = await puppeteer.launch({ headless: true, timeout: 15000,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-background-networking'] });
  page = await browser.newPage(); page.setDefaultTimeout(10000);
  await page.setViewport({ width: 1200, height: 820, deviceScaleFactor: 1 });
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', async dialog => {
    if (expectDeleteConfirmation && dialog.type() === 'confirm' &&
        dialog.message().startsWith('Delete this saved event note and any unsaved edits?')) {
      expectDeleteConfirmation = false;
      await dialog.accept();
    } else {
      errors.push(`Unexpected ${dialog.type()} dialog: ${dialog.message()}`);
      await dialog.dismiss();
    }
  });
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = new URL(request.url());
    if (['data:', 'blob:'].includes(url.protocol)) return void request.continue();
    if (url.origin !== base.origin || url.pathname.startsWith('/api/')) {
      unexpected.push(url.pathname); return void request.abort();
    }
    if (request.resourceType() === 'document') return void request.respond({ contentType: 'text/html', body: `<!doctype html><html><head>
      <link rel="icon" href="data:,"><link rel="stylesheet" href="/cesium/Widgets/widgets.css">
      <style>html,body,#globe{width:100%;height:100%;margin:0;overflow:hidden}</style>
      </head><body><div id="globe"></div></body></html>` });
    void request.continue();
  });
  mark('mount-workspace-and-real-renderer');
  await page.goto(base.href, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    window.CESIUM_BASE_URL = '/cesium/';
    const { mountMarkerScene } = await import('/scripts/qa-astroeye-marker-scene.js');
    const { createWorldRecordStore } = await import('/src/core/worldRecordStore.js');
    const { EventBus } = await import('/src/core/eventBus.js');
    const { ModuleStateCoordinator } = await import('/src/core/moduleState.js');
    const { WorldClock } = await import('/src/core/worldClock.js');
    const { createResearchAnnotations } = await import('/src/modules/astroeye/researchAnnotations.js');
    const { createAstroEyeWorkspaceController } = await import('/src/modules/astroeye/workspaceController.js');
    const { mountAstroEyeWorkspace } = await import('/src/modules/astroeye/astroeyeWorkspace.js');
    const store = createWorldRecordStore({ databaseName: 'qa-map-workspace-synthetic' });
    const eventBus = new EventBus(), notes = createResearchAnnotations(store);
    const scene = mountMarkerScene(document.getElementById('globe'), { eventBus, loadAnnotations: () => notes.load() });
    const controller = createAstroEyeWorkspaceController({ recordStore: store, eventBus,
      moduleState: new ModuleStateCoordinator({ eventBus }), worldClock: new WorldClock({ eventBus }) });
    await controller.saveDraft({ id: 'synthetic-map-event', title: 'Synthetic map event', sport: 'QA', competition: 'QA',
      home: 'A', away: 'B', venueName: 'Synthetic', latitude: 40, longitude: -75,
      localDate: '2026-09-15', localTime: '12:00', timeZone: 'UTC' });
    const workspace = mountAstroEyeWorkspace({ controller, researchAnnotations: notes, researchAnnotationLayer: scene.layer });
    const sentinel = scene.viewer.entities.add({ id: 'unrelated-owner-sentinel' });
    window.qa = { store, notes, scene, workspace, controller, sentinel };
    await workspace.open(); await workspace.selectSavedEvent('synthetic-map-event', { navigate: false });
  });
  await page.waitForFunction(() => { qa.scene.render(); return qa.scene.surfaceReady(); }, { polling: 200 });
  assert.equal(await page.evaluate(() => qa.scene.reads()), 0);
  const camera = await page.evaluate(() => qa.scene.camera());
  const eventCharts = await page.evaluate(async () => { const { events, charts } = await qa.store.exportRecords(); return { events, charts }; });
  const settle = () => page.waitForFunction(() => !document.querySelector('[data-annotation="reload"]').disabled && !qa.scene.layer.state().loading);
  const click = async action => { await page.$eval(`[data-annotation="${action}"]`, node => node.click()); await settle(); };
  const edit = text => page.$eval('[data-role="event-notes"] textarea', (node, value) => {
    node.value = value; node.dispatchEvent(new Event('input', { bubbles: true }));
  }, text);
  const project = () => page.evaluate(async () => {
    const note = (await qa.notes.load()).annotations[0]; return note ? qa.scene.pointFor(note) : null;
  });
  const rendered = () => page.evaluate(() => new Promise(resolve => {
    const off = qa.scene.viewer.scene.postRender.addEventListener(() => { off(); resolve(); }); qa.scene.render();
  }));
  await page.$eval('[data-action="event-notes"]', node => node.click()); await settle();
  mark('save-off-then-explicit-map-opt-in');
  await click('new'); await edit('PRIVATE-MAP-WORKSPACE <img src=x>'); await click('save');
  assert.equal(await page.evaluate(() => qa.scene.layer.state().shown), 0);
  assert.equal(await page.evaluate(() => qa.scene.reads()), 0);
  const backup = await page.evaluate(() => qa.store.serializeRecords());
  const selection = await page.evaluate(() => qa.controller.selectionSnapshot());
  await click('map-toggle');
  await page.evaluate(() => qa.workspace.close());
  await page.waitForFunction(async () => {
    qa.scene.render(); return qa.scene.pointFor((await qa.notes.load()).annotations[0])?.picked;
  }, { polling: 200 });
  assert.equal(await page.evaluate(() => qa.scene.layer.state().shown), 1);
  assert.doesNotMatch(JSON.stringify(await page.evaluate(() => qa.scene.visibleLabels())), /PRIVATE|img/);
  assert.equal(await page.evaluate(() => qa.store.serializeRecords()), backup);
  assert.deepEqual(await page.evaluate(() => qa.controller.selectionSnapshot()), selection);
  await rendered();
  const point = await project(), output = resolve('qa-shots/astroeye-map-workspace');
  assert.ok(point.x >= 8 && point.x < 1192 && point.y >= 8 && point.y < 812);
  await mkdir(output, { recursive: true });
  const shown = resolve(output, 'shown.png'), hidden = resolve(output, 'hidden.png');
  await page.screenshot({ path: shown });
  const amber = async path => {
    const { data, info } = await sharp(path).extract({ left: Math.round(point.x) - 8, top: Math.round(point.y) - 8,
      width: 17, height: 17 }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    let count = 0;
    for (let i = 0; i < data.length; i += info.channels) if (data[i] > 210 && data[i + 1] > 140 && data[i + 1] < 230 && data[i + 2] > 40 && data[i + 2] < 165) count++;
    return count;
  };
  const visibleAmberPixels = await amber(shown); assert.ok(visibleAmberPixels >= 12);
  mark('edit-delete-undo-through-workspace');
  await page.evaluate(() => qa.workspace.open()); await settle();
  await edit('PRIVATE-MAP-WORKSPACE edited'); await click('save');
  assert.equal(await page.evaluate(() => qa.scene.layer.state().shown), 1);
  assert.doesNotMatch(JSON.stringify(await page.evaluate(() => qa.scene.visibleLabels())), /PRIVATE|edited/);
  mark('confirm-synthetic-note-deletion');
  expectDeleteConfirmation = true;
  await click('delete');
  assert.equal(expectDeleteConfirmation, false);
  assert.equal(await page.evaluate(() => qa.scene.layer.state().shown), 0);
  await page.evaluate(() => qa.workspace.close()); await rendered();
  await page.screenshot({ path: hidden });
  assert.equal(await amber(hidden), 0); assert.equal(await project(), null);
  mark('undo-synthetic-note-deletion');
  await page.evaluate(() => qa.workspace.open()); await settle(); await click('undo');
  await page.evaluate(() => qa.workspace.close());
  await page.waitForFunction(async () => {
    qa.scene.render(); return qa.scene.pointFor((await qa.notes.load()).annotations[0])?.picked;
  }, { polling: 200 });
  assert.equal(await page.evaluate(async () => (await qa.notes.load()).annotations[0].note), 'PRIVATE-MAP-WORKSPACE edited');
  mark('camera-privacy-playback-and-owner-cleanup');
  const after = await page.evaluate(() => qa.scene.camera());
  for (const key of ['position', 'direction', 'up']) for (const axis of ['x', 'y', 'z']) {
    assert.ok(Math.abs(after[key][axis] - camera[key][axis]) <= (key === 'position' ? 1e-6 : 1e-12));
  }
  assert.deepEqual(await page.evaluate(async () => { const { events, charts } = await qa.store.exportRecords(); return { events, charts }; }), eventCharts);
  await page.evaluate(() => document.body.classList.add('scene-playback-mode'));
  await page.waitForFunction(() => !qa.scene.layer.state().enabled && qa.scene.layer.state().shown === 0);
  await page.evaluate(() => document.body.classList.remove('scene-playback-mode'));
  assert.equal(await page.evaluate(() => qa.scene.layer.state().enabled), false);
  assert.deepEqual(await page.evaluate(() => qa.scene.diagnostics().renderErrors), []);
  assert.deepEqual(errors, []); assert.deepEqual(unexpected, []);
  assert.equal(await page.evaluate(() => {
    qa.workspace.destroy(); qa.scene.layer.destroy();
    return qa.scene.viewer.entities.values.length === 1 && qa.scene.viewer.entities.getById('unrelated-owner-sentinel') === qa.sentinel;
  }), true);
  await page.evaluate(async () => { qa.scene.destroy(); await qa.store.close(); });
  report = { passed: true, workspaceAndRealCesiumLayer: true, nativeIsolatedStorage: true,
    optInOnly: true, visibleAmberPixels, deleteHidesPixels: true, undoRestoresPicking: true,
    privateTextExcluded: true, chartAndCameraPreserved: true, noPlaybackAutoResume: true,
    ownerOnlyCleanup: true, mainAppBootstrapped: false, referenceMeshOnly: true, terrainVerified: false,
    embeddedHostVerified: false, actualDirectorPlayed: false, userDataAccessed: false, images: { shown, hidden } };
} catch (error) {
  report = { passed: false, phase, error: error.message, errors, unexpected };
} finally {
  console.error(JSON.stringify({ validation: report }));
  try { (report ??= { passed: false }).cleanup = await closeOwnedBrowser(browser, { page }); }
  finally { clearTimeout(watchdog); }
}
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.passed && report.cleanup.status === 'graceful' ? 0 : 1;
