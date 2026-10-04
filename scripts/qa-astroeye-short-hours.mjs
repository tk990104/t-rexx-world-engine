import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';
import { closeOwnedBrowser } from './qa-owned-browser-cleanup.mjs';

let browser, page;
const deadline = setTimeout(() => {
  console.error('Short-hour UI check exceeded its 60-second budget.');
  const owned = browser?.process();
  if (owned && owned.exitCode === null && owned.signalCode === null) owned.kill();
  process.exit(1);
}, 60000);
try {
  browser = await puppeteer.launch({ headless: true, timeout: 15000, args: ['--disable-gpu'] });
  page = await browser.newPage();
  page.setDefaultTimeout(10000);
  const base = process.env.QA_BASE_URL || 'http://127.0.0.1:5175';
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request', request => {
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
    const eventBus = new EventBus(), recordStore = createWorldRecordStore({ databaseName: 'qa-short-hours-isolated' });
    const controller = createAstroEyeWorkspaceController({ recordStore, eventBus,
      moduleState: new ModuleStateCoordinator({ eventBus }), worldClock: new WorldClock({ eventBus }) });
    for (const [id, date, time, latitude] of [
      ['short-day', '2025-01-16', '12:10:00', 70], ['short-night', '2024-05-16', '00:01:50', 70],
      ['ordinary', '2024-03-10', '12:30:00', 40], ['unavailable', '2025-01-15', '12:00:00', 70],
    ]) {
      await controller.saveDraft({ id, title: id, sport: 'Synthetic', competition: 'QA', home: 'A', away: 'B',
        localDate: date, localTime: time, timeZone: 'UTC', venueName: 'Synthetic only', latitude, longitude: 0 });
    }
    const workspace = mountAstroEyeWorkspace({ controller });
    await workspace.open();
    window.shortHourQA = { workspace, controller, recordStore, before: await recordStore.serializeRecords() };
  });
  const label = '[data-chart="planetary-hour"]', notice = '[data-chart="planetary-hour-notice"]';
  for (const id of ['short-day', 'short-night']) {
    await page.evaluate(id => window.shortHourQA.workspace.selectSavedEvent(id), id);
    assert.match(await page.$eval(label, n => n.textContent), /\(provisional\)$/);
    assert.match(await page.$eval(notice, n => n.textContent), /not an accuracy guarantee/);
    assert.equal(await page.$eval(notice, n => n.dataset.uncertain), 'true');
    for (const width of [390, 1280]) {
      await page.setViewport({ width, height: 844 });
      for (const selector of [label, notice]) assert.ok(await page.$eval(selector, n =>
        n.getClientRects().length > 0 && getComputedStyle(n).display !== 'none' && n.scrollWidth <= n.clientWidth + 1));
    }
    await page.evaluate(async () => { window.shortHourQA.workspace.close(); await window.shortHourQA.workspace.open(); });
    assert.match(await page.$eval(label, n => n.textContent), /\(provisional\)$/);
    await page.evaluate(() => window.shortHourQA.workspace.selectSavedEvent('ordinary'));
    assert.doesNotMatch(await page.$eval(label, n => n.textContent), /provisional|uncertain/);
    assert.match(await page.$eval(notice, n => n.textContent), /estimates/);
    assert.equal(await page.$eval(notice, n => n.dataset.uncertain), 'false');
  }
  await page.evaluate(() => window.shortHourQA.workspace.selectSavedEvent('short-day'));
  await page.$eval('[data-action="time-forward"]', n => n.click());
  await page.waitForFunction(() => document.querySelector('[data-chart="planetary-hour-notice"]').dataset.uncertain === 'false');
  await page.$eval('[data-action="time-reset"]', n => n.click());
  await page.waitForFunction(() => document.querySelector('[data-chart="planetary-hour"]').textContent.endsWith('(provisional)'));
  await page.evaluate(() => window.shortHourQA.workspace.selectSavedEvent('unavailable'));
  assert.equal(await page.$eval(label, n => n.textContent), 'Unavailable');
  assert.doesNotMatch(await page.$eval(notice, n => n.textContent), /Short calculated interval/);
  assert.equal(await page.evaluate(async () => (await window.shortHourQA.recordStore.serializeRecords()) === window.shortHourQA.before), true);
  assert.deepEqual(errors, []);
  await page.evaluate(() => window.shortHourQA.workspace.destroy());
  console.log('PASS: short day/night cautions, selection/preview/reset/reopen, narrow/wide layout and byte-unchanged synthetic records.');
} finally {
  try {
    const cleanup = await closeOwnedBrowser(browser, { page });
    console.log('Owned browser cleanup:', JSON.stringify(cleanup));
    assert.equal(cleanup.status, 'graceful');
  } finally { clearTimeout(deadline); }
}
