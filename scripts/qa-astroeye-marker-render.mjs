import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import puppeteer from 'puppeteer';
import sharp from 'sharp';
import { closeOwnedBrowser } from './qa-owned-browser-cleanup.mjs';

let browser, page, report;
const assetFailures = [], consoleErrors = [], unexpected = [], errors = [];
const watchdog = setTimeout(() => { browser?.process()?.kill(); process.exit(1); }, 60000);
const output = resolve('qa-shots/astroeye-note-markers');
try {
  await mkdir(output, { recursive: true });
  browser = await puppeteer.launch({ headless: true, timeout: 15000,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-background-networking'] });
  page = await browser.newPage(); page.setDefaultTimeout(20000);
  await page.setViewport({ width: 1200, height: 820, deviceScaleFactor: 1 });
  const base = new URL(process.env.QA_BASE_URL || 'http://127.0.0.1:5173');
  assert.ok(['127.0.0.1', 'localhost'].includes(base.hostname));
  page.on('response', (response) => { if (response.status() >= 400) assetFailures.push({ status: response.status(), path: new URL(response.url()).pathname }); });
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 300)); });
  page.on('pageerror', (error) => errors.push(error.name));
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (['data:', 'blob:'].includes(url.protocol)) return void request.continue();
    if (url.origin !== base.origin || url.pathname.startsWith('/api/')) {
      unexpected.push({ origin: url.origin, path: url.pathname }); return void request.abort();
    }
    if (request.resourceType() === 'document') return void request.respond({ contentType: 'text/html;charset=utf-8', body: `<!doctype html><html><head><meta charset="utf-8">
      <link rel="icon" href="data:,"><link rel="stylesheet" href="/cesium/Widgets/widgets.css"><style>html,body,#globe{width:100%;height:100%;margin:0;overflow:hidden}
      #caption{position:absolute;top:12px;left:12px;z-index:2;color:#fff;background:#101b29;padding:10px;font:14px sans-serif;pointer-events:none}</style>
      </head><body><div id="globe"></div><div id="caption">Offline rendering check · synthetic event notes</div></body></html>` });
    void request.continue();
  });
  await page.goto(base.href, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    window.CESIUM_BASE_URL = '/cesium/';
    // No application bootstrap, storage, speech or provider configuration in this fixture.
    const { mountMarkerScene } = await import('/scripts/qa-astroeye-marker-scene.js');
    window.qa = mountMarkerScene(document.getElementById('globe'));
  });
  assert.equal(await page.evaluate(() => qa.scene3D()), true);
  await page.waitForFunction(() => { qa.render(); return qa.surfaceReady(); }, { polling: 200 });
  assert.equal(await page.evaluate(() => qa.reads()), 0);
  const camera = await page.evaluate(() => qa.camera());
  await page.evaluate(() => qa.layer.setEnabled(true));
  await page.waitForFunction(() => { qa.render(); return qa.points().every((point) => point?.picked); }, { polling: 200 });
  const points = await page.evaluate(() => qa.points());
  for (const point of points) assert.ok(point.x > 15 && point.x < 1185 && point.y > 65 && point.y < 805);
  const shown = resolve(output, 'shown.png'), hidden = resolve(output, 'hidden.png');
  const renderedFrame = () => page.evaluate(() => new Promise((resolve) => {
    const off = qa.viewer.scene.postRender.addEventListener(() => { off(); resolve(); }); qa.render();
  }));
  await renderedFrame();
  await page.screenshot({ path: shown });
  async function amberPixels(path, point) {
    const { data, info } = await sharp(path).extract({ left: Math.round(point.x) - 8, top: Math.round(point.y) - 8, width: 17, height: 17 }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    let count = 0;
    for (let i = 0; i < data.length; i += info.channels) if (data[i] > 210 && data[i + 1] > 140 && data[i + 1] < 230 && data[i + 2] > 40 && data[i + 2] < 165) count++;
    return count;
  }
  const visiblePixels = await Promise.all(points.map((point) => amberPixels(shown, point)));
  assert.ok(visiblePixels.every((count) => count >= 12), 'Each projected marker must contain visible amber pixels');
  await page.evaluate(() => qa.layer.setEnabled(false));
  await page.waitForFunction(() => { qa.render(); return qa.points().every((point) => !point?.picked); }, { polling: 200 });
  await renderedFrame();
  await page.screenshot({ path: hidden });
  const hiddenPixels = await Promise.all(points.map((point) => amberPixels(hidden, point)));
  assert.ok(hiddenPixels.every((count) => count === 0));
  const afterCamera = await page.evaluate(() => qa.camera());
  // Cesium renormalizes orientation vectors during render. Permit only roundoff:
  // one micrometer in position and 1e-12 per unit-vector component.
  for (const field of ['position', 'direction', 'up']) for (const axis of ['x', 'y', 'z']) {
    assert.ok(Math.abs(afterCamera[field][axis] - camera[field][axis]) <= (field === 'position' ? 1e-6 : 1e-12), `Camera ${field}.${axis} moved`);
  }
  await page.evaluate(() => qa.layer.setEnabled(true));
  await page.waitForFunction(() => qa.points().every((point) => point?.picked), { polling: 200 });
  await page.evaluate(() => qa.coincide());
  await page.waitForFunction(() => qa.points().some((point) => point?.picked), { polling: 200 });
  assert.deepEqual(await page.evaluate(() => qa.visibleLabels()), [{ id: 't-rexx-astroeye-note-astroeye-note%3Arender-0',
    text: '3 event notes · captured UTC\nFirst: 2026-09-15T10:00:00.000Z\nLast: 2026-09-15T12:00:00.000Z' }]);
  assert.equal(await page.evaluate(() => qa.layer.state().shown), 3);
  await renderedFrame();
  const coincident = resolve(output, 'coincident.png');
  await page.screenshot({ path: coincident });
  assert.ok(await amberPixels(coincident, (await page.evaluate(() => qa.points()))[0]) >= 12);
  await page.evaluate(() => qa.faceAway());
  await page.waitForFunction(() => { qa.render(); return qa.surfaceReady(); }, { polling: 200 });
  await renderedFrame();
  const farSide = await page.evaluate(() => qa.points());
  await page.screenshot({ path: resolve(output, 'far-side.png') });
  assert.ok(farSide.every((point) => !point?.picked), 'Far-side note markers must not be picked through the globe');
  await page.evaluate(() => document.body.classList.add('scene-playback-mode'));
  await page.waitForFunction(() => !qa.layer.state().enabled && qa.layer.state().shown === 0);
  await page.evaluate(() => document.body.classList.remove('scene-playback-mode'));
  assert.equal(await page.evaluate(() => qa.layer.state().enabled), false);
  assert.deepEqual(errors, []); assert.deepEqual(unexpected, []); assert.deepEqual(assetFailures, []);
  assert.deepEqual(await page.evaluate(() => qa.diagnostics().renderErrors), []);
  await page.evaluate(() => qa.destroy());
  report = { passed: true, realCesium3D: true, referenceEllipsoidPicked: true, terrainVerified: false, pickedMarkers: points.length, visibleAmberPixels: visiblePixels,
    hiddenAmberPixels: hiddenPixels, cameraUnchanged: true, farSideOccluded: true, noPlaybackAutoResume: true,
    coincidentCountAndRange: true, images: { shown, hidden, coincident }, syntheticDataOnly: true, externalRequests: 0, embeddedHostVerified: false };
} catch (error) {
  process.stdout.write(`${JSON.stringify({ failed: error.name, diagnostics: await page?.evaluate(() => window.qa?.diagnostics()).catch(() => null), assetFailures, consoleErrors, unexpected, errors })}\n`);
  throw error;
} finally {
  try { const cleanup = await closeOwnedBrowser(browser, { page }); if (report) report.cleanup = cleanup; }
  finally { clearTimeout(watchdog); }
}
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`, () => process.exit(report?.passed && report?.cleanup.status === 'graceful' ? 0 : 1));
