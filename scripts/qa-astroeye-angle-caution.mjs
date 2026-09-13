import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';

let browser;
const deadline = setTimeout(async () => {
  console.error('Angle-caution UI check exceeded its 60-second budget.');
  await Promise.race([browser?.close(), new Promise((resolve) => setTimeout(resolve, 2000))]);
  browser?.process()?.kill(); process.exit(1);
}, 60000);
try {
  browser = await puppeteer.launch({ headless: true, timeout: 15000, args: ['--disable-gpu'] });
  const page = await browser.newPage();
  page.setDefaultTimeout(10000);
  const base = process.env.QA_BASE_URL || 'http://127.0.0.1:5173';
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
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
    const { EventBus } = await import('/src/core/eventBus.js');
    const { ModuleStateCoordinator } = await import('/src/core/moduleState.js');
    const { WorldClock } = await import('/src/core/worldClock.js');
    const eventBus = new EventBus(), recordStore = createWorldRecordStore({ databaseName: 'qa-angle-caution-isolated' });
    const controller = createAstroEyeWorkspaceController({ recordStore, eventBus,
      moduleState: new ModuleStateCoordinator({ eventBus }), worldClock: new WorldClock({ eventBus }) });
    for (const [id, latitude] of [['polar', 80], ['ordinary', 40]]) {
      await controller.saveDraft({ id, title: id, sport: 'Synthetic', competition: 'QA', home: 'A', away: 'B',
        localDate: '2026-09-13', localTime: '12:00', timeZone: 'UTC', venueName: 'Test only', latitude, longitude: 12.345678 });
    }
    const downloads = [];
    const workspace = mountAstroEyeWorkspace({ controller, downloadComparison: (value) => downloads.push(value) });
    await workspace.open();
    const before = await recordStore.serializeRecords();
    await workspace.selectSavedEvent('polar');
    window.angleQA = { workspace, recordStore, downloads, before };
  });
  const warning = '[data-chart="angle-caution"]';
  assert.match(await page.$eval(warning, (node) => node.textContent), /provisional/);
  assert.equal(await page.$eval(warning, (node) => node.hidden), false);
  await page.$eval('[data-comparison="pin"]', (node) => node.click());
  await page.evaluate(() => window.angleQA.workspace.selectSavedEvent('ordinary'));
  assert.equal(await page.$eval(warning, (node) => node.hidden), true);
  assert.equal(await page.$eval(warning, (node) => node.textContent), '');
  assert.match(await page.$eval('[data-comparison="warning"]', (node) => node.textContent), /Pinned snapshot — High-latitude/);
  await page.$eval('[data-comparison="export"]', (node) => node.click());
  const report = await page.evaluate(() => window.angleQA.downloads.at(-1));
  assert.match(report, /Pinned snapshot — High-latitude/);
  assert.ok(!report.includes('12.345678'));
  await page.evaluate(() => window.angleQA.workspace.selectSavedEvent('polar'));
  for (const width of [390, 1280]) {
    await page.setViewport({ width, height: 844 });
    assert.ok(await page.$eval(warning, (node) => !node.hidden && node.scrollWidth <= node.clientWidth + 1));
    await page.$eval('#astroeye-workspace', (node) => { node.dataset.skyCompact = 'true'; });
    assert.ok(await page.$eval(warning, (node) => node.getClientRects().length > 0 && getComputedStyle(node).display !== 'none' && node.scrollWidth <= node.clientWidth + 1));
    await page.$eval('#astroeye-workspace', (node) => { delete node.dataset.skyCompact; });
  }
  await page.evaluate(async () => {
    window.angleQA.workspace.close(); await window.angleQA.workspace.open();
  });
  assert.equal(await page.$eval(warning, (node) => node.hidden), false);
  assert.equal(await page.evaluate(async () => (await window.angleQA.recordStore.serializeRecords()) === window.angleQA.before), true);
  assert.deepEqual(errors, []);
  await page.evaluate(() => window.angleQA.workspace.destroy());
  console.log('PASS: chart and pinned/report cautions, clear/reopen, narrow/wide layout, and unchanged isolated records.');
} finally {
  try { await browser?.close(); } finally { clearTimeout(deadline); }
}
