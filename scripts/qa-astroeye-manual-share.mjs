import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';
import { closeOwnedBrowser } from './qa-owned-browser-cleanup.mjs';

// Real workspace/form/storage, mocked camera seam, fresh isolated sender/recipient contexts.
let browser, sender, recipient, report, phase = 'startup';
const errors = [], unexpected = [];
const watchdog = setTimeout(() => {
  process.stderr.write(`${JSON.stringify({ failed: '60-second watchdog', phase })}\n`);
  browser?.process()?.kill(); process.exit(1);
}, 60000);
try {
  const base = new URL(process.env.QA_BASE_URL || 'http://127.0.0.1:5173');
  assert.ok(['127.0.0.1', 'localhost'].includes(base.hostname));
  browser = await puppeteer.launch({ headless: true, timeout: 15000,
    args: ['--disable-gpu', '--disable-background-networking'] });
  async function open(url) {
    const context = await browser.createBrowserContext(), page = await context.newPage();
    page.setDefaultTimeout(10000);
    await page.setViewport({ width: 1200, height: 900 });
    page.on('pageerror', (error) => errors.push(error.name));
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const address = new URL(request.url());
      if (address.protocol === 'data:' && request.resourceType() === 'image' && address.pathname.startsWith('image/svg+xml;base64,')) return void request.continue();
      if (address.origin !== base.origin || address.pathname.startsWith('/api/')) {
        unexpected.push('blocked-request'); return void request.abort();
      }
      if (request.resourceType() === 'document') return void request.respond({ contentType: 'text/html;charset=utf-8',
        body: '<!doctype html><html><head><title>Synthetic manual/share check</title></head><body></body></html>' });
      void request.continue();
    });
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await mount(page);
    return page;
  }
  async function mount(page) {
    await page.evaluate(async () => {
      const { mountAstroEyeWorkspace } = await import('/src/modules/astroeye/astroeyeWorkspace.js');
      const { createAstroEyeWorkspaceController } = await import('/src/modules/astroeye/workspaceController.js');
      const { createWorldRecordStore } = await import('/src/core/worldRecordStore.js');
      const { createResearchAnnotations } = await import('/src/modules/astroeye/researchAnnotations.js');
      const { createResearchNotebook } = await import('/src/modules/astroeye/researchNotebook.js');
      const { readSharedViewHash } = await import('/src/modules/astroeye/shareView.js');
      const { EventBus } = await import('/src/core/eventBus.js');
      const { WorldClock } = await import('/src/core/worldClock.js');
      const { ModuleStateCoordinator } = await import('/src/core/moduleState.js');
      const store = createWorldRecordStore({ databaseName: 'qa-manual-share-synthetic' });
      const eventBus = new EventBus(), worldClock = new WorldClock({ eventBus });
      const qa = { store, navigation: 0, presentationNavigation: [] };
      const controller = createAstroEyeWorkspaceController({ recordStore: store, eventBus, worldClock,
        moduleState: new ModuleStateCoordinator({ eventBus }), presentEvent: async (_event, _chart, options = {}) => {
          qa.presentationNavigation.push(options.navigate);
          if (options.navigate !== false) qa.navigation++;
        } });
      const notes = createResearchAnnotations(store), notebook = createResearchNotebook(store);
      const workspace = mountAstroEyeWorkspace({ controller, researchAnnotations: notes, researchNotebook: notebook,
        createWorldLink: () => `${location.origin}/#v=2&lat=40&lon=-75&alt=10000&heading=12&pitch=-42&roll=0` });
      Object.assign(qa, { controller, workspace, notes, notebook, incoming: readSharedViewHash(location.hash) });
      window.qa = qa;
      await workspace.open();
      if (qa.incoming.status !== 'absent') qa.restored = await workspace.restoreSharedView(qa.incoming);
    });
  }
  const records = (page) => page.evaluate(() => qa.store.serializeRecords());
  const click = async (page, action) => {
    await page.$eval(`[data-action="${action}"]`, (node) => node.click());
    await page.waitForFunction(() => !document.querySelector('#astroeye-workspace').dataset.busy);
  };
  phase = 'sender-mount'; sender = await open(base.href);
  phase = 'manual-form';
  const empty = await records(sender);
  await sender.$eval('.astroeye-form', (form) => {
    const values = { title: 'Synthetic São Paulo 🦖', sport: 'QA', competition: 'QA', away: 'Away', home: 'Home',
      venueName: 'Synthetic venue', latitude: '40', longitude: '-75', localDate: '2026-11-01', localTime: '01:30:00',
      timeZone: 'America/New_York', houseSystem: 'equal' };
    for (const [name, value] of Object.entries(values)) form.elements.namedItem(name).value = value;
    form.elements.namedItem('timeZone').dispatchEvent(new Event('change', { bubbles: true }));
    form.requestSubmit();
  });
  assert.equal(await sender.$eval('[name="utcStart"]', (node) => node.required && !node.value), true);
  assert.equal(await records(sender), empty, 'Ambiguous manual form must not save without choosing an occurrence');
  await sender.select('[name="utcStart"]', '2026-11-01T06:30:00.000Z');
  await sender.focus('.astroeye-form button[type="submit"]'); await sender.keyboard.press('Enter');
  await sender.waitForSelector('.astroeye-chart:not([hidden]) svg');
  await sender.waitForFunction(() => !document.querySelector('#astroeye-workspace').dataset.busy);
  const saved = JSON.parse(await records(sender));
  assert.equal(saved.events.length, 1); assert.equal(saved.charts.length, 1);
  assert.equal(saved.events[0].utcStart, '2026-11-01T06:30:00.000Z');
  assert.equal(saved.events[0].source.kind, 'manual');
  assert.equal(await sender.evaluate(() => qa.navigation), 1);
  phase = 'sender-preview-and-share';
  await click(sender, 'time-back');
  const beforePreview = await records(sender);
  assert.deepEqual(JSON.parse(beforePreview), saved);
  await sender.evaluate(async () => {
    await qa.notes.add(qa.controller.selectionSnapshot(), 'PRIVATE-SYNTHETIC-EVENT-NOTE', null);
    await qa.notebook.save('PRIVATE-SYNTHETIC-NOTEBOOK', null);
  });
  const privateBackup = await records(sender);
  await click(sender, 'share-view');
  const link = await sender.$eval('#astroeye-view-link', (node) => node.value);
  const payload = await sender.evaluate(() => qa.controller.shareSnapshot());
  assert.doesNotMatch(JSON.stringify(payload), /PRIVATE-SYNTHETIC|workspaces|annotations/);
  assert.equal(payload.offsetMinutes, -15);
  const expected = await sender.evaluate(() => ({ selection: qa.controller.selectionSnapshot(),
    wheel: document.querySelector('[data-chart="wheel"]').innerHTML }));
  assert.equal(await records(sender), privateBackup);
  phase = 'recipient-mount'; recipient = await open(link);
  phase = 'recipient-preview';
  assert.notEqual(sender.browserContext(), recipient.browserContext());
  assert.equal(await recipient.evaluate(() => qa.restored), true);
  assert.deepEqual(await recipient.evaluate(() => qa.incoming.snapshot), payload);
  assert.equal(await records(recipient), empty, 'Viewing a share must not save event, chart or private notes');
  assert.equal(await recipient.evaluate(() => qa.navigation), 0);
  assert.deepEqual(await recipient.evaluate(() => qa.presentationNavigation), [false]);
  const actual = await recipient.evaluate(() => qa.controller.selectionSnapshot());
  assert.equal(actual.isShared, true); assert.deepEqual(actual.chart, expected.selection.chart);
  assert.equal(actual.chart.calculatedFor, '2026-11-01T06:15:00.000Z');
  assert.equal(await recipient.$eval('[data-chart="wheel"]', (node) => node.innerHTML), expected.wheel);
  assert.equal(await recipient.$eval('[data-action="delete"]', (node) => node.hidden), true);
  await click(recipient, 'event-notes');
  await recipient.waitForFunction(() => !document.querySelector('[data-annotation="reload"]').disabled);
  assert.equal(await recipient.$eval('[data-annotation="new"]', (node) => node.disabled), true);
  assert.equal(await records(recipient), empty);
  phase = 'explicit-copy'; await click(recipient, 'save-shared');
  const copied = JSON.parse(await records(recipient));
  assert.equal(copied.events.length, 1); assert.equal(copied.charts.length, 1); assert.deepEqual(copied.workspaces, []);
  assert.notEqual(copied.events[0].id, saved.events[0].id);
  assert.equal(copied.charts[0].calculatedFor, '2026-11-01T06:30:00.000Z');
  assert.equal(await recipient.evaluate(() => qa.controller.selectionSnapshot().chart.calculatedFor), '2026-11-01T06:15:00.000Z');
  assert.equal(await recipient.evaluate(() => qa.navigation), 0);
  assert.equal(await records(sender), privateBackup);
  const beforeBad = await records(recipient);
  assert.deepEqual(await recipient.evaluate(() => qa.presentationNavigation), [false, false]);
  await recipient.evaluate(() => { qa.workspace.destroy(); return qa.store.close(); });
  const bad = new URL(link); const hash = new URLSearchParams(bad.hash.slice(1)); hash.set('ae', 'bad'); bad.hash = hash.toString();
  phase = 'malformed-link';
  await recipient.goto('about:blank'); // Avoid same-document hash navigation.
  await recipient.goto(bad.href, { waitUntil: 'domcontentloaded' }); await mount(recipient);
  assert.equal(await recipient.evaluate(() => qa.restored), false);
  assert.equal(await recipient.$eval('.astroeye-chart', (node) => node.hidden), true);
  assert.equal(await records(recipient), beforeBad);
  for (const page of [sender, recipient]) await page.evaluate(() => { qa.workspace.destroy(); return qa.store.close(); });
  assert.deepEqual(errors, []); assert.deepEqual(unexpected, []);
  report = { passed: true, manualFormAndExplicitFold: true, previewDoesNotWrite: true,
    isolatedRecipientContext: true, sameChartAndWheel: true, privateNotesExcluded: true, viewingDoesNotSave: true,
    sharedNoteCaptureRefused: true, explicitCopyOnly: true, malformedLinkPreservesRecords: true,
    mainAppBootstrapped: false, cameraSeamMocked: true, embeddedHostVerified: false, externalRequests: 0, userDataAccessed: false };
} catch (error) {
  process.stderr.write(`${JSON.stringify({ failed: error.name, phase })}\n`);
  throw error;
} finally {
  phase = 'cleanup';
  let senderClose = 'not-needed', timer;
  try {
    // This fixture owns two pages. Close both before browser teardown, with the
    // same bounded page-first policy; never enumerate or attach to user pages.
    if (sender && !sender.isClosed()) {
      senderClose = await Promise.race([
        sender.close({ runBeforeUnload: false }).then(() => 'completed', () => 'failed'),
        new Promise((resolve) => { timer = setTimeout(() => resolve('timeout'), 3000); }),
      ]);
    }
  } finally { clearTimeout(timer); }
  try {
    const cleanup = { ...await closeOwnedBrowser(browser, { page: recipient ?? sender }), senderClose };
    if (report) report.cleanup = cleanup;
    else process.stdout.write(`${JSON.stringify({ failedBeforeReport: true, cleanup })}\n`);
  }
  finally { clearTimeout(watchdog); }
}
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`, () => process.exit(report?.passed && report?.cleanup.status === 'graceful'
  && ['completed', 'not-needed'].includes(report.cleanup.senderClose) ? 0 : 1));
