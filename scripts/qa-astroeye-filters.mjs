import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import puppeteer from 'puppeteer';

// Isolated DOM-only check: real workspace/layer, in-memory records, no globe or tours.
let browser;
const deadline = setTimeout(async () => {
  console.error('Filter UI check exceeded its 60-second budget.');
  await Promise.race([browser?.close(), new Promise((resolve) => setTimeout(resolve, 2000))]);
  browser?.process()?.kill();
  process.exit(1);
}, 60000);
try {
  browser = await puppeteer.launch({ headless: true, timeout: 15000, args: ['--disable-gpu'] });
  const page = await browser.newPage();
  page.setDefaultTimeout(15000);
  const base = process.env.QA_BASE_URL || 'http://127.0.0.1:5173';
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    if (request.resourceType() === 'document') void request.respond({ contentType: 'text/html', body: '<html><head></head><body style="background:#080d19"></body></html>' });
    else if (new URL(request.url()).origin !== new URL(base).origin) void request.abort();
    else void request.continue();
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    const { mountAstroEyeWorkspace } = await import('/src/modules/astroeye/astroeyeWorkspace.js');
    const { createSavedEventLayer } = await import('/src/modules/astroeye/savedEventLayer.js');
    const { createSavedEventFramer } = await import('/src/modules/astroeye/savedEventFrame.js');
    const { EventBus } = await import('/src/core/eventBus.js');
    const records = ['West', 'East', 'North'].map((name, i) => ({ id: name, title: `${name} <b>event</b>`, sport: 'Demo', competition: 'Cup',
      venue: { name: `${name} Arena`, latitude: 40, longitude: -74 }, scheduledLocal: { date: `2026-09-${12 + i}`, time: '12:00', timeZone: 'UTC' }, utcStart: `2026-09-${12 + i}T12:00:00Z` }));
    const entities = new Map();
    let reads = 0;
    let flights = 0, allowed = true;
    const listEvents = async () => { reads++; return structuredClone(records); };
    const forbidden = () => { throw new Error('Filtering must not change chart, camera or records'); };
    const controller = Object.fromEntries(['saveDraft', 'selectEvent', 'deleteEvent', 'serializeRecords', 'importRecords', 'previewTime', 'refocusSelected', 'shareSnapshot', 'restoreSharedView', 'saveSharedCopy'].map((key) => [key, forbidden]));
    const viewer = { entities: { add: (entity) => entities.set(entity.id, entity), removeById: (id) => entities.delete(id) }, scene: { requestRender() {} },
      camera: { cancelFlight() {}, flyTo() { flights++; } } };
    const layer = createSavedEventLayer({ viewer,
      listEvents, getSelection: () => null, eventBus: new EventBus() });
    const workspace = mountAstroEyeWorkspace({ controller: { ...controller, listEvents }, savedEventLayer: layer,
      onViewSavedEvents: createSavedEventFramer({ viewer, getPoints: layer.framePoints, canInteract: () => allowed, runNavigation: (_noun, navigate) => navigate() }) });
    await workspace.open(); await layer.setEnabled(true);
    window.filterQA = { layer, workspace, reads: () => reads, flights: () => flights, allow: (value) => { allowed = value; } };
  });
  const ids = () => page.$$eval('[data-role="event-list"] [data-event-id]', (nodes) => nodes.map((node) => node.dataset.eventId));
  const apply = (values) => page.$eval('.astroeye-event-filters', (form, fields) => {
    for (const [name, value] of Object.entries(fields)) form.elements.namedItem(name).value = value;
    form.requestSubmit();
  }, values);
  assert.equal((await ids()).length, 3);
  const reads = await page.evaluate(() => window.filterQA.reads());
  await apply({ query: 'WEST', dateFrom: '2026-09-12', dateTo: '2026-09-12' });
  assert.deepEqual(await ids(), ['West']);
  assert.equal(await page.evaluate(() => window.filterQA.layer.state().shown), 1);
  await apply({ dateFrom: '2026-09-14', dateTo: '2026-09-12' });
  assert.deepEqual(await ids(), ['West']);
  assert.equal(await page.evaluate(() => window.filterQA.layer.state().shown), 1);
  assert.match(await page.$eval('[data-role="filter-status"]', (node) => node.textContent), /Previous filters/);
  await apply({ query: 'missing', dateFrom: '', dateTo: '' });
  assert.deepEqual(await ids(), []);
  assert.equal(await page.evaluate(() => window.filterQA.layer.state().shown), 0);
  assert.equal(await page.$eval('[data-action="frame-saved-map"]', (button) => button.disabled), true);
  await page.$eval('[data-filter-reset]', (button) => button.click());
  assert.equal((await ids()).length, 3);
  await page.focus('.astroeye-event-filters [name="query"]');
  await page.keyboard.type('east'); await page.keyboard.press('Enter');
  assert.deepEqual(await ids(), ['East']);
  assert.equal(await page.evaluate(() => window.filterQA.reads()), reads);
  assert.deepEqual(errors, []);
  await page.setViewport({ width: 390, height: 844 });
  await page.$eval('.astroeye-event-filters', (node) => node.scrollIntoView({ block: 'center' }));
  assert.ok(await page.$eval('.astroeye-event-filters', (node) => node.scrollWidth <= node.clientWidth + 1));
  mkdirSync('qa-shots/astroeye-filters', { recursive: true });
  await page.screenshot({ path: 'qa-shots/astroeye-filters/mobile.png' });
  assert.equal(await page.evaluate(() => window.filterQA.flights()), 0, 'filtering never moves the camera');
  await page.evaluate(() => window.filterQA.allow(false));
  await page.$eval('[data-action="frame-saved-map"]', (button) => button.click());
  assert.equal(await page.evaluate(() => window.filterQA.flights()), 0);
  assert.equal(await page.$eval('#astroeye-workspace', (node) => node.hidden), false);
  await page.evaluate(() => window.filterQA.allow(true));
  await page.$eval('[data-action="frame-saved-map"]', (button) => button.click());
  assert.equal(await page.evaluate(() => window.filterQA.flights()), 1);
  assert.equal(await page.$eval('#astroeye-workspace', (node) => node.hidden), true);
  assert.equal(await page.evaluate(() => window.filterQA.reads()), reads);
  assert.deepEqual(errors, []);
  console.log('PASS: explicit framing only, empty-state disable, playback refusal and panel close after one camera request.');
  console.log('PASS: list/map parity, inclusive dates, invalid-range rollback, empty/reset, keyboard submit, no reads/writes/navigation on filtering, mobile width and no page errors.');
} finally {
  await browser?.close();
  clearTimeout(deadline);
}
