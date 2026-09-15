import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';
import { closeOwnedBrowser } from './qa-owned-browser-cleanup.mjs';

// Authored component QA only: fresh profile, synthetic IndexedDB, no app bootstrap.
let browser, page, report;
const watchdog = setTimeout(() => { browser?.process()?.kill(); process.exit(1); }, 90000);
try {
  browser = await puppeteer.launch({ headless: true, timeout: 15000, args: ['--disable-gpu', '--disable-background-networking'] });
  page = await browser.newPage(); page.setDefaultTimeout(10000);
  const base = process.env.QA_BASE_URL || 'http://127.0.0.1:5173';
  const errors = [], unexpected = [];
  page.on('pageerror', (error) => errors.push(error.name));
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.origin !== new URL(base).origin || url.pathname.startsWith('/api/')) {
      unexpected.push('blocked-request'); void request.abort();
    } else if (request.resourceType() === 'document') void request.respond({ contentType: 'text/html', body: '<html><body><section id="notes" hidden></section></body></html>' });
    else void request.continue();
  });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    const { mountResearchAnnotations } = await import('/src/modules/astroeye/researchAnnotationsPanel.js');
    const { createResearchAnnotations } = await import('/src/modules/astroeye/researchAnnotations.js');
    const { createWorldRecordStore } = await import('/src/core/worldRecordStore.js');
    const { eventFromDraft } = await import('/src/modules/astroeye/workspaceController.js');
    const store = createWorldRecordStore({ databaseName: 'qa-annotation-editor-synthetic' });
    const event = eventFromDraft({ id: 'source', title: 'Synthetic QA', sport: 'QA', competition: 'QA', home: 'H', away: 'A',
      localDate: '2026-09-14', localTime: '12:00', timeZone: 'UTC', venueName: 'QA', latitude: 40, longitude: -75 });
    await store.saveEvent(event);
    await store.saveWorkspace({ id: 'unrelated', text: 'Notebook sentinel' });
    const service = createResearchAnnotations(store);
    const selection = { event, chart: { eventId: 'source', calculatedFor: '2026-09-14T12:15:00.000Z' } };
    const qa = { service, store, event, selection, reads: 0, confirms: [], allow: true, downloads: [], fail: false, failRead: false,
      hold: false, release: null, holdSource: false, sourceReleases: [], failRestore: false };
    const wrapped = { ...service,
      load: async () => { qa.reads++; if (qa.failRead) throw new Error('Synthetic read failure'); return service.load(); },
      edit: async (...args) => {
        if (qa.fail) throw new Error('Synthetic quota failure');
        if (qa.hold) await new Promise((resolve) => { qa.release = resolve; });
        return service.edit(...args);
      },
      restore: async (...args) => {
        if (qa.failRestore) throw new Error('Synthetic restore failure');
        return service.restore(...args);
      },
      sourceState: async (entry) => {
        if (qa.holdSource) return new Promise((resolve) => qa.sourceReleases.push(resolve));
        return service.sourceState(entry);
      },
    };
    qa.mount = () => mountResearchAnnotations(document.querySelector('#notes'), { annotations: wrapped,
      confirmDiscard: (message) => { qa.confirms.push(message); return qa.allow; }, downloadDraft: (file) => qa.downloads.push(file) });
    qa.panel = qa.mount(); qa.panel.updateSelection(selection);
    qa.original = await store.exportRecords(); window.qa = qa;
  });
  const status = () => page.$eval('[data-annotation="status"]', (node) => node.textContent);
  const value = () => page.$eval('#notes textarea', (node) => node.value);
  const settle = () => page.waitForFunction(() => !document.querySelector('[data-annotation="reload"]').disabled);
  const click = async (name) => { await page.$eval(`[data-annotation="${name}"]`, (node) => node.click()); await settle(); };
  const edit = (text) => page.$eval('#notes textarea', (node, text) => { node.value = text; node.dispatchEvent(new Event('input', { bubbles: true })); }, text);
  const choose = async (id) => {
    await page.select('[data-annotation="list"]', id);
    await page.waitForFunction(() => document.querySelector('[data-annotation="source"]').textContent !== 'Checking source event…');
  };
  const dirty = () => page.evaluate(() => { const event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event); return event.defaultPrevented; });
  assert.equal(await page.evaluate(() => qa.reads), 0);
  await page.evaluate(() => qa.panel.open()); await settle();
  assert.equal(await page.evaluate(() => qa.service.load()), null);
  assert.equal(await dirty(), false);
  await page.evaluate(() => qa.panel.updateSelection({ ...qa.selection, isShared: true }));
  assert.equal(await page.$eval('[data-annotation="new"]', (node) => node.disabled), true);
  await page.evaluate(() => qa.panel.updateSelection(qa.selection));
  await click('new');
  assert.equal(await page.evaluate(() => document.activeElement === document.querySelector('#notes textarea')), true);
  const text = 'Private <img src=x onerror=alert(1)>\n🦖 observation';
  await edit(text); assert.equal(await dirty(), true);
  await page.evaluate(() => {
    qa.selection.chart.calculatedFor = '2026-09-14T13:00:00.000Z';
    qa.selection.event.venue.latitude = 1; qa.panel.updateSelection(qa.selection);
    document.querySelector('#notes').hidden = true; qa.panel.open();
  });
  assert.equal(await value(), text);
  assert.match(await page.$eval('[data-annotation="capture"]', (node) => node.textContent), /12:15:00.000Z · 40, -75/);
  await click('download'); assert.equal(await dirty(), true);
  assert.equal(await page.evaluate(() => qa.downloads.at(-1).text), text);
  await click('save'); assert.equal(await dirty(), false);
  const first = await page.evaluate(async () => (await qa.service.load()).annotations[0]);
  assert.equal(first.note, text); assert.equal(first.latitude, 40); assert.match(first.chartTimeUtc, /12:15/);
  assert.equal(await page.$('#notes img'), null);
  // Recreate the component and read IndexedDB again, rather than reusing editor state.
  await page.evaluate(() => { qa.panel.destroy(); qa.panel = qa.mount(); qa.panel.updateSelection(qa.selection); qa.panel.open(); });
  await settle(); await choose(first.id); assert.equal(await value(), text);
  await edit('Edited text'); await click('save');
  assert.deepEqual(await page.evaluate(async () => (await qa.service.load()).annotations[0]), { ...first, note: 'Edited text' });
  await edit('Unsaved draft');
  await page.evaluate(() => { qa.allow = false; }); await click('reload');
  assert.equal(await value(), 'Unsaved draft'); await choose(''); assert.equal(await value(), 'Unsaved draft');
  assert.equal(await page.$eval('[data-annotation="list"]', (node) => node.value), first.id);
  await click('delete'); assert.equal(await value(), 'Unsaved draft');
  await page.evaluate(() => { qa.fail = true; }); await click('save');
  assert.match(await status(), /quota failure/); assert.equal(await value(), 'Unsaved draft'); assert.equal(await dirty(), true);
  await page.evaluate(async () => { qa.fail = false; const old = await qa.service.load(); await qa.service.edit(old.annotations[0].id, 'Other tab wins', old); });
  await click('save'); assert.match(await status(), /changed in storage/); assert.equal(await value(), 'Unsaved draft');
  await page.evaluate(() => { qa.allow = true; }); await click('delete');
  assert.match(await status(), /changed in storage/); assert.equal(await value(), 'Unsaved draft');
  assert.equal(await page.evaluate(async () => (await qa.service.load()).annotations[0].note), 'Other tab wins');
  await page.evaluate(() => { qa.allow = true; qa.failRead = true; }); await click('reload');
  assert.match(await status(), /read failure/); assert.equal(await value(), 'Unsaved draft');
  await page.evaluate(() => { qa.failRead = false; }); await click('reload'); await choose(first.id);
  assert.equal(await value(), 'Other tab wins');
  await page.evaluate(async () => { await qa.store.deleteEvent('source'); });
  await choose(first.id);
  assert.match(await page.$eval('[data-annotation="source"]', (node) => node.textContent), /missing/);
  await click('new'); assert.match(await status(), /Save the source event/); assert.equal(await value(), 'Other tab wins');
  await page.evaluate(async () => { await qa.store.restoreDeletedEvent({ event: qa.event, charts: [] }); });
  await click('new'); await edit('Second note'); await click('save');
  const secondId = await page.$eval('[data-annotation="list"]', (node) => node.value);
  const savedSecond = await page.evaluate(async () => (await qa.service.load()).annotations.at(-1));
  await edit('Unsaved second-note edit');
  await click('delete');
  assert.deepEqual(await page.evaluate(async () => (await qa.service.load()).annotations.map((entry) => entry.id)), [first.id]);
  assert.notEqual(secondId, first.id);
  assert.equal(await page.$eval('[data-annotation="undo"]', (node) => node.disabled), false);
  await page.evaluate(() => { qa.failRestore = true; }); await click('undo');
  assert.match(await status(), /restore failure/);
  assert.equal(await page.$eval('[data-annotation="undo"]', (node) => node.disabled), false);
  await page.evaluate(async () => {
    qa.failRestore = false;
    const old = await qa.service.load(); await qa.service.edit(old.annotations[0].id, 'Newer unrelated edit', old);
  });
  await click('undo'); assert.match(await status(), /changed in storage/);
  await click('reload'); await click('undo');
  assert.equal(await value(), savedSecond.note);
  assert.deepEqual(await page.evaluate(async () => (await qa.service.load()).annotations.at(-1)), savedSecond);
  assert.equal(await page.$eval('[data-annotation="undo"]', (node) => node.disabled), true);
  await click('delete');
  // Same-ID recreation is never overwritten, even after an explicit reload.
  await page.evaluate(async (entry) => { await qa.service.restore(entry, await qa.service.load()); }, savedSecond);
  await click('reload'); await click('undo'); assert.match(await status(), /already in use/);
  await choose(secondId); await click('delete');
  // Source-status promises from a previously opened note cannot overwrite a newer check.
  await page.evaluate(() => { qa.holdSource = true; });
  await page.select('[data-annotation="list"]', first.id);
  await page.select('[data-annotation="list"]', '');
  await page.select('[data-annotation="list"]', first.id);
  await page.evaluate(() => { qa.sourceReleases[1]('source-present'); });
  await page.waitForFunction(() => document.querySelector('[data-annotation="source"]').textContent.includes('found'));
  await page.evaluate(() => { qa.sourceReleases[0]('source-missing'); });
  assert.match(await page.$eval('[data-annotation="source"]', (node) => node.textContent), /found/);
  await page.evaluate(() => { qa.holdSource = false; });
  // New-note capture is fixed when requested, even if selection changes during its source read.
  await page.evaluate(() => { qa.holdSource = true; });
  await page.$eval('[data-annotation="new"]', (node) => node.click());
  await page.waitForFunction(() => qa.sourceReleases.length === 3);
  await page.evaluate(() => {
    qa.selection.chart.calculatedFor = '2026-09-14T14:00:00.000Z'; qa.panel.updateSelection(qa.selection);
    qa.holdSource = false; qa.sourceReleases[2]('source-present');
  });
  await settle();
  assert.match(await page.$eval('[data-annotation="capture"]', (node) => node.textContent), /13:00:00.000Z/);
  assert.equal(await page.evaluate(async () => (await qa.service.load()).annotations.length), 1);
  await choose(first.id);
  // Successful writes may finish after destroy; detached UI must not be resurrected.
  await edit('Pending save'); await page.evaluate(() => { qa.hold = true; });
  await page.$eval('[data-annotation="save"]', (node) => node.click());
  await page.waitForFunction(() => typeof qa.release === 'function');
  assert.equal(await page.$eval('#notes textarea', (node) => node.disabled), true);
  await page.evaluate(() => { qa.panel.destroy(); qa.release(); });
  await page.waitForFunction(async () => (await qa.service.load()).annotations[0].note === 'Pending save');
  assert.equal(await page.$eval('#notes', (node) => node.children.length), 0);
  assert.equal(await dirty(), false);
  await page.evaluate(() => { qa.panel = qa.mount(); qa.panel.open(); }); await settle();
  assert.equal(await page.$eval('[data-annotation="undo"]', (node) => node.disabled), true);
  await page.evaluate(() => qa.panel.destroy());
  assert.deepEqual(await page.evaluate(() => qa.store.getWorkspace('unrelated')), { id: 'unrelated', text: 'Notebook sentinel' });
  assert.deepEqual(await page.evaluate(() => qa.store.listCharts()), []);
  await page.evaluate(() => qa.store.close());
  assert.deepEqual(errors, []); assert.deepEqual(unexpected, []);
  report = { passed: true, savedReopenedEditedDeleted: true, frozenCapture: true, inertText: true,
    draftPreservedOnFailure: true, staleSaveAndDeleteRejected: true, missingSource: true, staleSourceResponseIgnored: true,
    delayedNewCaptureFrozen: true, newDraftFocused: true,
    sessionDeletionUndo: true, undoFailureRetried: true, undoConflictRefused: true, undoClearedOnRemount: true,
    destroyDuringSave: true, userDataAccessed: false, liveProviderRequests: 0, productionMounted: false };
} finally {
  try { const cleanup = await closeOwnedBrowser(browser, { page }); if (report) report.cleanup = cleanup; }
  finally { clearTimeout(watchdog); }
}
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`, () => process.exit(report?.passed && report?.cleanup.status === 'graceful' ? 0 : 1));
