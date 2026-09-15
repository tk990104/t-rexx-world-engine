import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';
import { closeOwnedBrowser } from './qa-owned-browser-cleanup.mjs';
import { checkDirectorWorkflow } from './qa-astroeye-director-workflow.mjs';
import { checkCollectionWorkflow } from './qa-astroeye-collection-workflow.mjs';

// Synthetic HTTP provider responses + real workspace/controller/IndexedDB.
// Explicit diagnostic relay only; this does not certify normal host loading.
assert.ok(process.argv.includes('--node-assets'), 'Pass --node-assets to acknowledge the diagnostic asset transport');
const collectionsOnly = process.argv.includes('--collections');
const collectionSize = Number(process.argv.find((arg) => arg.startsWith('--collection-size='))?.split('=')[1] ?? 100);
assert.ok(!collectionsOnly || [25, 100, 1000].includes(collectionSize), 'Collection size must be 25, 100 or 1000');
assert.ok(!collectionsOnly || !process.argv.includes('--director'), 'Run collection timing separately from Director');
let browser, page, report, phase = 'startup', venueUnavailable = false;
const errors = [], blocked = [], relayFailures = [], calls = [];
const started = Date.now();
const mark = (value) => { phase = value; process.stderr.write(`${JSON.stringify({ phase, elapsedMs: Date.now() - started })}\n`); };
const watchdog = setTimeout(() => {
  process.stderr.write(`${JSON.stringify({ failed: '60-second watchdog', phase })}\n`);
  browser?.process()?.kill(); process.exit(1);
}, 60000);
const game = {
  sourceEventId: '90001', title: 'Synthetic Away at Synthetic Home', home: 'Synthetic Home', away: 'Synthetic Away',
  sport: 'American Football', competition: 'NFL', utcStart: '2026-11-01T06:30:00.000Z',
  venueId: '9001', venueName: 'Synthetic venue', city: 'New York', status: 'NS',
  source: { kind: 'provider', provider: 'thesportsdb', sourceEventId: '90001', retrievedAt: '2026-09-10T00:00:00.000Z' },
};
try {
  const base = new URL(process.env.QA_BASE_URL || 'http://127.0.0.1:5173');
  assert.ok(['127.0.0.1', 'localhost'].includes(base.hostname));
  browser = await puppeteer.launch({ headless: true, timeout: 15000, args: ['--disable-gpu', '--disable-background-networking'] });
  const context = await browser.createBrowserContext(); page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', (error) => errors.push(error.name));
  await page.setRequestInterception(true);
  page.on('request', async (request) => {
    const address = new URL(request.url());
    if (address.origin === base.origin && address.pathname === '/api/astroeye/sports') {
      const venue = address.searchParams.has('venue'); calls.push(venue ? 'venue' : 'schedule');
      const body = venue ? (venueUnavailable ? { error: 'Synthetic venue lookup unavailable' } :
        { venue: { name: 'Synthetic venue', coordinates: { latitude: 40.7128, longitude: -74.006 }, timeZoneHint: 'Eastern time' } }) :
        { events: [game], retrievedAt: game.source.retrievedAt, access: 'free', cached: false, skipped: 0 };
      return void request.respond({ status: venue && venueUnavailable ? 503 : 200, contentType: 'application/json', body: JSON.stringify(body) });
    }
    if (address.protocol === 'data:' && request.resourceType() === 'image' && address.pathname.startsWith('image/svg+xml;base64,')) return void request.continue();
    if (address.origin !== base.origin || address.pathname.startsWith('/api/')) {
      blocked.push('blocked-request'); return void request.abort();
    }
    if (request.resourceType() === 'document') return void request.respond({ contentType: 'text/html',
      body: '<!doctype html><html><head><link rel="icon" href="data:,"><title>Synthetic provider review</title></head><body></body></html>' });
    try {
      const response = await fetch(address.href, { redirect: 'manual', signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error('Asset response refused');
      await request.respond({ status: response.status, contentType: response.headers.get('content-type') ?? 'application/octet-stream',
        body: Buffer.from(await response.arrayBuffer()) });
    } catch { relayFailures.push(address.pathname); await request.abort().catch(() => {}); }
  });
  mark('workspace-mount');
  await page.goto(base.href, { waitUntil: 'domcontentloaded' });
  let timer;
  try { await Promise.race([page.evaluate(async () => {
    const { mountAstroEyeWorkspace } = await import('/src/modules/astroeye/astroeyeWorkspace.js');
    const { createAstroEyeWorkspaceController } = await import('/src/modules/astroeye/workspaceController.js');
    const { createWorldRecordStore } = await import('/src/core/worldRecordStore.js');
    const { createResearchAnnotations } = await import('/src/modules/astroeye/researchAnnotations.js');
    const { createResearchNotebook } = await import('/src/modules/astroeye/researchNotebook.js');
    const { EventBus } = await import('/src/core/eventBus.js');
    const { WorldClock } = await import('/src/core/worldClock.js');
    const { ModuleStateCoordinator } = await import('/src/core/moduleState.js');
    const store = createWorldRecordStore({ databaseName: 'qa-provider-workspace-synthetic' });
    const eventBus = new EventBus(), worldClock = new WorldClock({ eventBus });
    const qa = { store, navigation: 0 };
    const controller = createAstroEyeWorkspaceController({ recordStore: store, eventBus, worldClock,
      moduleState: new ModuleStateCoordinator({ eventBus }), presentEvent: async (_event, _chart, options = {}) => {
        if (options.navigate !== false) qa.navigation++;
      } });
    const notes = createResearchAnnotations(store), notebook = createResearchNotebook(store);
    const workspace = mountAstroEyeWorkspace({ controller, researchAnnotations: notes, researchNotebook: notebook });
    window.qa = Object.assign(qa, { controller, workspace, notes, notebook });
    await workspace.open();
  }), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Workspace mount exceeded 20 seconds')), 20000); })]);
  } finally { clearTimeout(timer); }
  const records = () => page.evaluate(() => qa.store.serializeRecords());
  const field = (name) => page.$eval(`[name="${name}"]`, (node) => node.value);
  const setField = (name, value) => page.$eval(`[name="${name}"]`, (node, next) => {
    node.value = next; node.dispatchEvent(new Event('input', { bubbles: true })); node.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
  const click = (selector) => page.$eval(selector, (node) => node.click());
  const submit = () => page.$eval('.astroeye-form', (form) => form.requestSubmit());
  const empty = await records();
  assert.deepEqual(JSON.parse(empty), { schemaVersion: 1, events: [], charts: [], workspaces: [] });
  if (collectionsOnly) {
    const collections = await checkCollectionWorkflow(page, mark, collectionSize);
    assert.deepEqual(calls, []); assert.deepEqual(errors, []); assert.deepEqual(blocked, []); assert.deepEqual(relayFailures, []);
    await page.evaluate(() => { qa.workspace.destroy(); return qa.store.close(); });
    report = { passed: true, collections, externalRequests: 0, userDataAccessed: false };
  } else {
  mark('provider-review');
  await click('[data-schedule="next"]'); await page.waitForSelector('[data-schedule-index="0"]');
  await click('[data-schedule-index="0"]'); await page.waitForSelector('[data-role="schedule-review"]:not([hidden])');
  assert.equal(await records(), empty);
  assert.equal(await field('timeZone'), '', 'Provider hint must not silently choose a zone');
  await setField('timeZone', 'America/New_York');
  assert.equal(await field('localTime'), '01:30:00');
  assert.equal(await field('utcStart'), game.utcStart, 'Provider instant selects the second repeated hour');
  assert.equal(await field('latitude'), '40.7128');
  await submit(); assert.equal(await records(), empty, 'Unreviewed provider form must not save');
  assert.equal(await page.$eval('[name="scheduleReviewed"]', (node) => node.required && !node.checked), true);
  await click('[name="scheduleReviewed"]'); await setField('venueName', 'Reviewed synthetic venue');
  assert.equal(await page.$eval('[name="scheduleReviewed"]', (node) => node.checked), false, 'Editing invalidates review');
  await submit(); assert.equal(await records(), empty);
  await click('[name="scheduleReviewed"]'); await submit();
  await page.waitForSelector('.astroeye-chart:not([hidden]) svg');
  await page.waitForFunction(() => !document.querySelector('#astroeye-workspace').dataset.busy);
  const saved = JSON.parse(await records());
  assert.equal(saved.events.length, 1); assert.equal(saved.charts.length, 1);
  assert.equal(saved.events[0].utcStart, game.utcStart); assert.deepEqual(saved.events[0].source, game.source);
  assert.equal(saved.events[0].venue.coordinateSource, 'user-reviewed');
  assert.equal(await page.evaluate(() => qa.navigation), 1);
  mark('private-research-and-unavailable-venue');
  await page.evaluate(async () => {
    await qa.notes.add(qa.controller.selectionSnapshot(), 'PRIVATE-SYNTHETIC-PROVIDER-NOTE', null);
    await qa.notebook.save('PRIVATE-SYNTHETIC-PROVIDER-NOTEBOOK', null);
  });
  const privateBackup = await records(); venueUnavailable = true;
  mark('venue-failure-handoff');
  await click('[data-schedule-index="0"]');
  await page.waitForFunction(() => document.querySelector('[data-schedule="status"]').textContent.includes('Venue lookup unavailable'));
  assert.equal(await field('latitude'), ''); assert.equal(await field('longitude'), '');
  await setField('timeZone', 'America/New_York'); await click('[name="scheduleReviewed"]'); await submit();
  assert.equal(await records(), privateBackup, 'Missing venue coordinates must not save or alter private research');
  mark('manual-fallback');
  await click('[data-action="new"]');
  assert.equal(await page.$eval('[data-role="schedule-review"]', (node) => node.hidden), true);
  assert.equal(await page.$eval('[name="scheduleReviewed"]', (node) => node.required), false);
  for (const [name, value] of Object.entries({ title: 'Synthetic manual fallback', home: 'Manual Home', away: 'Manual Away',
    venueName: 'Manual venue', latitude: '40', longitude: '-75',
    localDate: '2026-11-02', localTime: '12:00:00', timeZone: 'UTC' })) await setField(name, value);
  assert.deepEqual(await page.$eval('.astroeye-form', (form) => [...form.elements]
    .filter((node) => node.willValidate && !node.validity.valid).map((node) => ({ name: node.name, message: node.validationMessage }))), []);
  await submit();
  await page.waitForFunction(async () => (await qa.controller.listEvents()).length === 2);
  await page.waitForFunction(() => !document.querySelector('#astroeye-workspace').dataset.busy);
  const fallback = JSON.parse(await records());
  assert.equal(fallback.events.find((event) => event.title === 'Synthetic manual fallback').source.kind, 'manual');
  assert.deepEqual(fallback.workspaces, JSON.parse(privateBackup).workspaces);
  assert.deepEqual(fallback.events.find((event) => event.id === saved.events[0].id), saved.events[0]);
  assert.deepEqual(calls, ['schedule', 'venue', 'venue']);
  const director = process.argv.includes('--director') ? await checkDirectorWorkflow(page, mark) : undefined;
  assert.deepEqual(errors, []); assert.deepEqual(blocked, []); assert.deepEqual(relayFailures, []);
  await page.evaluate(() => { qa.workspace.destroy(); return qa.store.close(); });
  report = { passed: true, assetTransport: 'node-localhost', reviewRequired: true, editsInvalidateReview: true,
    repeatedHourPreserved: true, missingCoordinatesBlocked: true, manualFallback: true, privateResearchPreserved: true,
    providerResponses: 'synthetic', cameraSeamMocked: true, embeddedHostVerified: false, userDataAccessed: false, director };
  }
} catch (error) {
  report = { passed: false, phase, error: error.message, calls, errors, blocked, relayFailures };
} finally {
  mark('cleanup');
  try { (report ??= { passed: false }).cleanup = await closeOwnedBrowser(browser, { page }); }
  finally { clearTimeout(watchdog); }
}
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`, () => process.exit(report.passed && report.cleanup.status === 'graceful' ? 0 : 1));
