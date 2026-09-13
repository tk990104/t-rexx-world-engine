import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';

let browser;
const deadline = setTimeout(async () => {
  console.error('Notebook UI check exceeded its 60-second budget.');
  await Promise.race([browser?.close(), new Promise((resolve) => setTimeout(resolve, 2000))]);
  browser?.process()?.kill(); process.exit(1);
}, 60000);
try {
  browser = await puppeteer.launch({ headless: true, timeout: 15000, args: ['--disable-gpu'] });
  const page = await browser.newPage(); page.setDefaultTimeout(10000);
  await page.setViewport({ width: 390, height: 844 });
  const base = process.env.QA_BASE_URL || 'http://127.0.0.1:5173';
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    if (request.resourceType() === 'document') void request.respond({ contentType: 'text/html', body: '<html><body></body></html>' });
    else if (new URL(request.url()).origin !== new URL(base).origin) void request.abort();
    else void request.continue();
  });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    const { mountAstroEyeWorkspace } = await import('/src/modules/astroeye/astroeyeWorkspace.js');
    const { createAstroEyeWorkspaceController } = await import('/src/modules/astroeye/workspaceController.js');
    const { createWorldRecordStore } = await import('/src/core/worldRecordStore.js');
    const { createResearchNotebook } = await import('/src/modules/astroeye/researchNotebook.js');
    const { EventBus } = await import('/src/core/eventBus.js');
    const { ModuleStateCoordinator } = await import('/src/core/moduleState.js');
    const { WorldClock } = await import('/src/core/worldClock.js');
    const records = createWorldRecordStore({ databaseName: 'qa-notebook-isolated' });
    const notebook = createResearchNotebook(records); const eventBus = new EventBus();
    const controller = createAstroEyeWorkspaceController({ recordStore: records, eventBus,
      moduleState: new ModuleStateCoordinator({ eventBus }), worldClock: new WorldClock({ eventBus }) });
    await controller.saveDraft({ id: 'sample', title: 'Sample', sport: 'Demo', competition: 'Cup', home: 'Home', away: 'Away',
      localDate: '2026-09-12', localTime: '12:00', timeZone: 'UTC', venueName: 'Arena', latitude: 40, longitude: -75 });
    let reads = 0;
    const downloads = [];
    let failDownload = false;
    let holdSave = false, releaseSave;
    const workspace = mountAstroEyeWorkspace({ controller, researchNotebook: { save: async (text, expected) => {
      if (holdSave) await new Promise((resolve) => { releaseSave = resolve; });
      return notebook.save(text, expected);
    }, load: () => { reads++; return notebook.load(); } },
      downloadNotebookDraft: (file) => { if (failDownload) throw new Error('Simulated download failure'); downloads.push(file); } });
    await workspace.open();
    window.noteQA = { workspace, notebook, records, controller, downloads, setDownloadFailure: (value) => { failDownload = value; }, reads: () => reads,
      holdSave: () => { holdSave = true; }, releaseSave: () => { holdSave = false; releaseSave(); },
      before: await records.exportRecords(), selection: controller.selectionSnapshot() };
  });
  const value = () => page.$eval('.astroeye-research-notebook textarea', (node) => node.value);
  const status = () => page.$eval('[data-note="status"]', (node) => node.textContent);
  // Synthetic event verifies handler state without navigating or risking draft loss.
  const leaveBlocked = () => page.evaluate(() => {
    const event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event); return event.defaultPrevented;
  });
  const settle = () => page.waitForFunction(() => !document.querySelector('[data-note="reload"]').disabled);
  const click = async (name) => { await page.$eval(`[data-note="${name}"]`, (node) => node.click()); await settle(); };
  const edit = (text) => page.$eval('.astroeye-research-notebook textarea', (node, text) => { node.value = text; node.dispatchEvent(new Event('input', { bubbles: true })); }, text);
  assert.equal(await page.evaluate(() => window.noteQA.reads()), 0);
  assert.equal(await leaveBlocked(), false);
  await page.$eval('[data-action="research-notes"]', (node) => node.click()); await settle();
  assert.equal(await page.evaluate(() => document.activeElement.dataset.role), 'research-notebook');
  assert.equal(await leaveBlocked(), false);
  assert.equal(await page.$eval('[data-note="download"]', (node) => node.disabled), true);
  assert.equal(await page.$eval('[data-note="append-reference"]', (node) => node.disabled), true);
  await page.evaluate(() => window.noteQA.workspace.selectSavedEvent('sample'));
  const chartAction = async (name) => {
    await page.$eval(`[data-action="${name}"]`, (node) => node.click());
    await page.waitForFunction(() => !document.querySelector('#astroeye-workspace').dataset.busy);
  };
  await chartAction('time-forward');
  const selectedPreview = await page.evaluate(() => window.noteQA.controller.selectionSnapshot());
  await edit('Keep this existing draft.');
  await click('append-reference');
  assert.equal(await leaveBlocked(), true);
  const withReference = await value();
  assert.match(withReference, /^Keep this existing draft\.\n\n\[AstroEye chart reference\]/);
  assert.match(withReference, /Event: "Sample"/);
  assert.match(withReference, /2026-09-12T12:15:00.000Z/);
  assert.equal(await page.evaluate(() => document.activeElement.tagName), 'TEXTAREA');
  assert.equal(await page.evaluate(() => window.noteQA.notebook.load()), null);
  assert.deepEqual(await page.evaluate(() => window.noteQA.controller.selectionSnapshot()), selectedPreview);
  await chartAction('time-forward');
  assert.equal(await value(), withReference);
  assert.match(await page.$eval('[data-note="reference-status"]', (node) => node.textContent), /12:30:00.000Z/);
  await edit('x'.repeat(10000)); await click('append-reference');
  assert.equal(await value(), 'x'.repeat(10000));
  assert.match(await status(), /nothing was appended/);
  await chartAction('time-reset');
  console.log('PASS: append-current-reference preserves draft and exact preview time, makes no writes/selection changes, stays static across previews and refuses overflow without truncation.');
  const text = 'Observation <img src=x onerror=alert(1)>\nKeep this note private.';
  await edit(text);
  const beforeDownload = await page.evaluate(() => window.noteQA.records.serializeRecords());
  await click('download');
  assert.equal(await leaveBlocked(), true);
  assert.deepEqual(await page.evaluate(() => window.noteQA.downloads.at(-1)), { text, filename: 't-rexx-research-note-draft.txt', mimeType: 'text/plain;charset=utf-8' });
  assert.equal(await page.evaluate(() => window.noteQA.records.serializeRecords()), beforeDownload);
  assert.equal(await value(), text);
  assert.equal(await page.$eval('[data-note="save"]', (node) => node.disabled), false);
  assert.match(await page.$eval('[data-note="download-status"]', (node) => node.textContent), /download requested/);
  await page.evaluate(() => window.noteQA.setDownloadFailure(true));
  await click('download');
  assert.match(await page.$eval('[data-note="download-status"]', (node) => node.textContent), /Simulated download failure/);
  assert.equal(await value(), text);
  await page.evaluate(() => window.noteQA.setDownloadFailure(false));
  assert.equal(await page.evaluate(() => window.noteQA.notebook.load()), null);
  await page.evaluate(async () => { window.noteQA.workspace.close(); await window.noteQA.workspace.open(); });
  assert.equal(await value(), text);
  assert.equal(await leaveBlocked(), true);
  await page.evaluate(() => window.noteQA.holdSave());
  await page.$eval('[data-note="save"]', (node) => node.click());
  assert.equal(await leaveBlocked(), true);
  assert.equal(await page.$eval('.astroeye-research-notebook textarea', (node) => node.disabled), true);
  await page.evaluate(() => window.noteQA.releaseSave()); await settle();
  assert.match(await status(), /Notes saved/);
  assert.equal(await leaveBlocked(), false);
  assert.equal(await page.evaluate(async () => (await window.noteQA.notebook.load()).text), text);
  assert.equal(await page.$eval('.astroeye-research-notebook', (node) => node.querySelectorAll('img').length), 0);
  await edit('Unsaved draft');
  assert.equal(await leaveBlocked(), true);
  await edit(text); assert.equal(await leaveBlocked(), false);
  await edit('Unsaved draft');
  page.once('dialog', (dialog) => { void dialog.dismiss(); }); await click('reload');
  assert.equal(await value(), 'Unsaved draft');
  await page.evaluate(async () => {
    const { notebook } = window.noteQA;
    await notebook.save('Newer notes from another tab', await notebook.load());
  });
  await click('save'); assert.match(await status(), /changed in storage/);
  assert.equal(await leaveBlocked(), true);
  assert.equal(await value(), 'Unsaved draft');
  const beforeConflictDownload = await page.evaluate(() => window.noteQA.records.serializeRecords());
  await click('download');
  assert.equal(await page.evaluate(() => window.noteQA.downloads.at(-1).text), 'Unsaved draft');
  assert.equal(await page.evaluate(() => window.noteQA.records.serializeRecords()), beforeConflictDownload);
  assert.match(await status(), /changed in storage/);
  assert.equal(await page.$eval('[data-note="save"]', (node) => node.disabled), false);
  assert.equal(await page.evaluate(async () => (await window.noteQA.notebook.load()).text), 'Newer notes from another tab');
  page.once('dialog', (dialog) => { void dialog.accept(); }); await click('reload');
  assert.equal(await value(), 'Newer notes from another tab');
  assert.equal(await page.$eval('[data-note="save"]', (node) => node.disabled), true);
  assert.equal(await leaveBlocked(), false);
  for (const width of [390, 1280]) {
    await page.setViewport({ width, height: 844 });
    assert.ok(await page.$eval('.astroeye-research-notebook', (node) => node.scrollWidth <= node.clientWidth + 1));
  }
  const current = await page.evaluate(() => window.noteQA.records.exportRecords());
  const before = await page.evaluate(() => window.noteQA.before);
  assert.deepEqual(current.events, before.events); assert.deepEqual(current.charts, before.charts);
  assert.deepEqual(await page.evaluate(() => window.noteQA.controller.selectionSnapshot()), await page.evaluate(() => window.noteQA.selection));
  const matching = await page.evaluate(() => window.noteQA.controller.serializeMatchingRecords({}));
  assert.deepEqual(JSON.parse(matching).workspaces, []);
  await edit('Unsaved teardown check'); assert.equal(await leaveBlocked(), true);
  await page.evaluate(async () => { window.noteQA.workspace.destroy(); await window.noteQA.records.close(); });
  assert.equal(await leaveBlocked(), false);
  assert.deepEqual(errors, []);
  console.log('PASS: leave-warning handler arms on edits/reference append, remains active during save, panel close, conflicts and downloads, and clears on save, reload, reverting text or teardown. Native leave dialogs are not exercised.');
  console.log('PASS: exact unsaved draft download payload, empty guard, failure preserves text, conflict message/baseline retained and no saved-record changes. Native file saving is not exercised.');
  console.log('PASS: lazy load, explicit save, draft retained across close, literal text, conflict keeps draft/newer notes, reload confirmation, full-backup inclusion/matching-export exclusion, unchanged event/chart/selection and mobile/desktop bounds.');
} finally { await browser?.close(); clearTimeout(deadline); }
