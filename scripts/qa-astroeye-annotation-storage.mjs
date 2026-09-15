import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';
import { closeOwnedBrowser } from './qa-owned-browser-cleanup.mjs';

// Native IndexedDB, independent connections, disposable profile and synthetic data only.
let browser, page, report;
const errors = [], blocked = [];
const watchdog = setTimeout(() => { browser?.process()?.kill(); process.exit(1); }, 60000);
try {
  const base = new URL(process.env.QA_BASE_URL || 'http://127.0.0.1:5173');
  assert.ok(['127.0.0.1', 'localhost'].includes(base.hostname));
  browser = await puppeteer.launch({ headless: true, timeout: 15000,
    args: ['--disable-gpu', '--disable-background-networking'] });
  page = await browser.newPage(); page.setDefaultTimeout(10000);
  page.on('pageerror', (error) => errors.push(error.name));
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.origin !== base.origin || url.pathname.startsWith('/api/')) {
      blocked.push('blocked-request'); return void request.abort();
    }
    if (request.resourceType() === 'document') return void request.respond({ contentType: 'text/html;charset=utf-8',
      body: '<!doctype html><html><head><title>Synthetic annotation storage check</title></head><body></body></html>' });
    void request.continue();
  });
  await page.goto(base.href, { waitUntil: 'domcontentloaded' });
  const checks = await page.evaluate(async () => {
    const { createWorldRecordStore } = await import('/src/core/worldRecordStore.js');
    const { createResearchAnnotations, RESEARCH_ANNOTATIONS_ID } = await import('/src/modules/astroeye/researchAnnotations.js');
    const { createRecordImportReview } = await import('/src/modules/astroeye/recordImportReview.js');
    const { createResearchNotebook } = await import('/src/modules/astroeye/researchNotebook.js');
    const { eventFromDraft } = await import('/src/modules/astroeye/workspaceController.js');
    const check = (value, message) => { if (!value) throw new Error(message); };
    const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const refuses = async (action, pattern) => {
      try { await action(); } catch (error) { check(pattern.test(error.message), 'Unexpected refusal'); return; }
      throw new Error('Expected operation to be refused');
    };
    const a = createWorldRecordStore({ databaseName: 'qa-native-annotation-source' });
    const b = createWorldRecordStore({ databaseName: 'qa-native-annotation-source' });
    const destination = createWorldRecordStore({ databaseName: 'qa-native-annotation-destination' });
    const na = createResearchAnnotations(a), nb = createResearchAnnotations(b), nd = createResearchAnnotations(destination);
    try {
      const event = eventFromDraft({ id: 'synthetic-source', title: 'QA only', sport: 'QA', competition: 'QA', home: 'H', away: 'A',
        localDate: '2026-09-15', localTime: '12:00', timeZone: 'UTC', venueName: 'QA', latitude: 40, longitude: -75 });
      const selection = { event, chart: { eventId: event.id, calculatedFor: '2026-09-15T12:15:00.000Z' } };
      await a.saveEvent(event);
      const notebook = await createResearchNotebook(a).save('Separate synthetic notebook', null);
      check(await na.load() === null && await nb.load() === null, 'Reads must not create notes');
      const competing = await Promise.allSettled([na.add(selection, 'Synthetic A', null), nb.add(selection, 'Synthetic B', null)]);
      check(competing.filter((result) => result.status === 'fulfilled').length === 1, 'Initial writes need exactly one winner');
      const old = await nb.load(), id = old.annotations[0].id;
      const saved = await na.edit(id, '  <script>inert synthetic text</script>\n🦖  ', old);
      await refuses(() => nb.edit(id, 'Stale edit', old), /changed in storage/);
      await refuses(() => nb.remove(id, old), /changed in storage/);
      check(equal(await nb.load(), saved), 'Losing writer changed saved notes');
      await a.deleteEvent(event.id);
      check(await na.sourceState(saved.annotations[0]) === 'source-missing', 'Source deletion must be visible');
      check(equal(await na.load(), saved), 'Source deletion changed capture');
      await a.restoreDeletedEvent({ event, charts: [] });
      check(await na.sourceState(saved.annotations[0]) === 'source-present', 'Source restore must resolve reference');
      const empty = await na.remove(id, saved);
      const restored = await nb.restore(saved.annotations[0], empty);
      check(equal(restored, saved), 'Undo must restore exact frozen entry');
      check(equal(await createResearchNotebook(a).load(), notebook), 'Notebook changed');
      const backup = await a.serializeRecords();
      const review = createRecordImportReview({ recordStore: destination });
      await review.prepareImportRecords(backup);
      check(await nd.load() === null, 'Import review wrote notes');
      await review.confirmImportRecords();
      check(await destination.serializeRecords() === backup, 'Native backup round-trip changed bytes');
      await refuses(() => review.confirmImportRecords(), /review it/);
      const imported = await nd.load();
      const changed = await nd.edit(id, 'Destination change', imported);
      await review.prepareImportRecords(backup);
      await refuses(() => review.confirmImportRecords(), /Acknowledge/);
      await nd.edit(id, 'Newer destination change', changed);
      const beforeStale = await destination.serializeRecords();
      await refuses(() => review.confirmImportRecords({ allowOverwrite: true }), /changed since this review/);
      check(await destination.serializeRecords() === beforeStale, 'Stale import partially wrote');
      await review.prepareImportRecords(backup); await review.confirmImportRecords({ allowOverwrite: true });
      check(await destination.serializeRecords() === backup, 'Acknowledged restore changed bytes');
      const future = { id: RESEARCH_ANNOTATIONS_ID, schemaVersion: 99, kind: 'future', opaque: 'Synthetic future payload' };
      await a.saveWorkspace(future);
      const futureBackup = await a.serializeRecords();
      await review.prepareImportRecords(futureBackup); await review.confirmImportRecords({ allowOverwrite: true });
      await refuses(() => nd.load(), /Unsupported/);
      await refuses(() => nd.add(selection, 'Overwrite future', future), /Unsupported/);
      check(await destination.serializeRecords() === futureBackup, 'Future data was lost');
      await destination.close();
      check(await destination.serializeRecords() === futureBackup, 'Native close/reopen lost records');
      return { nativeIndexedDB: true, independentConnections: 2, singleInitialWinner: true, staleEditDeleteRefused: true,
        sourceDeleteRestorePreserved: true, exactUndo: true, notebookPreserved: true, exactBackupRoundTrip: true,
        reviewedImportIsReadOnly: true, staleImportAtomic: true, futurePayloadPreserved: true, connectionReopen: true };
    } finally { await Promise.all([a.close(), b.close(), destination.close()]); }
  });
  assert.deepEqual(errors, []); assert.deepEqual(blocked, []);
  report = { passed: true, ...checks, userDataAccessed: false, externalRequests: 0, embeddedHostVerified: false };
} finally {
  try { const cleanup = await closeOwnedBrowser(browser, { page }); if (report) report.cleanup = cleanup; }
  finally { clearTimeout(watchdog); }
}
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`, () => process.exit(report?.passed && report?.cleanup.status === 'graceful' ? 0 : 1));
