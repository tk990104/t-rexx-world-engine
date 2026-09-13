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
    const workspace = mountAstroEyeWorkspace({ controller, researchNotebook: { save: notebook.save, load: () => { reads++; return notebook.load(); } } });
    await workspace.open();
    window.noteQA = { workspace, notebook, records, controller, reads: () => reads,
      before: await records.exportRecords(), selection: controller.selectionSnapshot() };
  });
  const value = () => page.$eval('.astroeye-research-notebook textarea', (node) => node.value);
  const status = () => page.$eval('[data-note="status"]', (node) => node.textContent);
  const settle = () => page.waitForFunction(() => !document.querySelector('[data-note="reload"]').disabled);
  const click = async (name) => { await page.$eval(`[data-note="${name}"]`, (node) => node.click()); await settle(); };
  const edit = (text) => page.$eval('.astroeye-research-notebook textarea', (node, text) => { node.value = text; node.dispatchEvent(new Event('input', { bubbles: true })); }, text);
  assert.equal(await page.evaluate(() => window.noteQA.reads()), 0);
  await page.$eval('[data-action="research-notes"]', (node) => node.click()); await settle();
  assert.equal(await page.evaluate(() => document.activeElement.dataset.role), 'research-notebook');
  const text = 'Observation <img src=x onerror=alert(1)>\nKeep this note private.';
  await edit(text);
  assert.equal(await page.evaluate(() => window.noteQA.notebook.load()), null);
  await page.evaluate(async () => { window.noteQA.workspace.close(); await window.noteQA.workspace.open(); });
  assert.equal(await value(), text);
  await click('save'); assert.match(await status(), /Notes saved/);
  assert.equal(await page.evaluate(async () => (await window.noteQA.notebook.load()).text), text);
  assert.equal(await page.$eval('.astroeye-research-notebook', (node) => node.querySelectorAll('img').length), 0);
  await edit('Unsaved draft');
  page.once('dialog', (dialog) => { void dialog.dismiss(); }); await click('reload');
  assert.equal(await value(), 'Unsaved draft');
  await page.evaluate(async () => {
    const { notebook } = window.noteQA;
    await notebook.save('Newer notes from another tab', await notebook.load());
  });
  await click('save'); assert.match(await status(), /changed in storage/);
  assert.equal(await value(), 'Unsaved draft');
  assert.equal(await page.evaluate(async () => (await window.noteQA.notebook.load()).text), 'Newer notes from another tab');
  page.once('dialog', (dialog) => { void dialog.accept(); }); await click('reload');
  assert.equal(await value(), 'Newer notes from another tab');
  assert.equal(await page.$eval('[data-note="save"]', (node) => node.disabled), true);
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
  await page.evaluate(async () => { window.noteQA.workspace.destroy(); await window.noteQA.records.close(); });
  assert.deepEqual(errors, []);
  console.log('PASS: lazy load, explicit save, draft retained across close, literal text, conflict keeps draft/newer notes, reload confirmation, full-backup inclusion/matching-export exclusion, unchanged event/chart/selection and mobile/desktop bounds.');
} finally { await browser?.close(); clearTimeout(deadline); }
