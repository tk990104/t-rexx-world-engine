import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';

// Real workspace, controller and isolated IndexedDB; no globe, live feeds or user data.
let browser;
const deadline = setTimeout(async () => {
  console.error('Import UI check exceeded its 60-second budget.');
  await Promise.race([browser?.close(), new Promise((resolve) => setTimeout(resolve, 2000))]);
  browser?.process()?.kill();
  process.exit(1);
}, 60000);
try {
  browser = await puppeteer.launch({ headless: true, timeout: 15000, args: ['--disable-gpu'] });
  const page = await browser.newPage();
  page.setDefaultTimeout(10000);
  await page.setViewport({ width: 390, height: 844 });
  const base = process.env.QA_BASE_URL || 'http://127.0.0.1:5173';
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    if (request.resourceType() === 'document') void request.respond({ contentType: 'text/html', body: '<html><head></head><body style="background:#080d19"></body></html>' });
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
    const eventBus = new EventBus();
    const recordStore = createWorldRecordStore({ databaseName: 'qa-import-isolated' });
    const controller = createAstroEyeWorkspaceController({ recordStore, eventBus,
      moduleState: new ModuleStateCoordinator({ eventBus }), worldClock: new WorldClock({ eventBus }) });
    await controller.saveDraft({ id: 'original', title: 'Original', sport: 'Demo', competition: 'Cup', home: 'Home', away: 'Away',
      localDate: '2026-09-09', localTime: '20:15', timeZone: 'America/New_York', venueName: 'Arena', latitude: 40.75, longitude: -73.99 });
    const before = await recordStore.serializeRecords();
    const incoming = JSON.parse(before);
    incoming.events[0].title = 'Imported title';
    incoming.events.push({ ...incoming.events[0], id: 'new-event' });
    const workspace = mountAstroEyeWorkspace({ controller });
    await workspace.open();
    window.importQA = { workspace, recordStore, controller, incoming, before,
      choose(text, { oversized = false, delayed = false } = {}) {
        const file = new File([text], '<img src=x onerror=alert(1)>.json', { type: 'application/json' });
        if (oversized) Object.defineProperty(file, 'size', { value: 10 * 1024 * 1024 + 1 });
        if (delayed) file.text = () => new Promise((resolve) => { window.importQA.release = () => resolve(text); });
        const transfer = new DataTransfer(); transfer.items.add(file);
        const input = document.querySelector('[data-role="import-file"]');
        input.files = transfer.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      } };
  });
  const idle = () => page.waitForFunction(() => !document.querySelector('#astroeye-workspace').dataset.busy);
  const choose = async () => {
    await page.evaluate(() => window.importQA.choose(JSON.stringify(window.importQA.incoming)));
    await idle();
  };
  const click = async (action) => {
    await page.$eval(`[data-action="${action}"]`, (button) => button.click());
    await idle();
  };
  const saved = () => page.evaluate(() => window.importQA.recordStore.serializeRecords());
  const before = await saved();
  await choose();
  assert.equal(await saved(), before);
  assert.match(await page.$eval('[data-role="import-summary"]', (node) => node.textContent), /Events: 1 to add · 1 to overwrite/);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'astroeye-import-title');
  assert.equal(await page.$eval('[data-role="import-filename"]', (node) => node.querySelectorAll('img').length), 0);
  assert.ok(await page.$eval('[data-role="import-review"]', (node) => node.scrollWidth <= node.clientWidth + 1));
  await click('cancel-import');
  assert.equal(await saved(), before);
  assert.equal(await page.evaluate(() => document.activeElement.dataset.action), 'import');
  await choose();
  await click('confirm-import');
  assert.equal(JSON.parse(await saved()).events.length, 2);
  assert.equal(await page.evaluate(() => window.importQA.recordStore.getEvent('original').then((event) => event.title)), 'Imported title');
  assert.equal(await page.$eval('[data-role="import-review"]', (node) => node.hidden), true);
  await choose();
  await page.evaluate(() => window.importQA.recordStore.saveWorkspace({ id: 'newer-notes' }));
  const changed = await saved();
  await click('confirm-import');
  assert.equal(await saved(), changed);
  assert.match(await page.$eval('.astroeye-live-status', (node) => node.textContent), /changed since this review/);
  for (const [text, options, message] of [['{', {}, /JSON|property/i], ['{}', { oversized: true }, /10 MiB/]]) {
    await page.evaluate((text, options) => window.importQA.choose(text, options), text, options);
    await idle();
    assert.match(await page.$eval('.astroeye-live-status', (node) => node.textContent), message);
    assert.equal(await page.$eval('[data-role="import-review"]', (node) => node.hidden), true);
    assert.equal(await saved(), changed);
  }
  await choose();
  await page.keyboard.press('Escape');
  assert.equal(await page.$eval('[data-role="import-review"]', (node) => node.hidden), true);
  await page.evaluate(() => window.importQA.workspace.open());
  await page.evaluate(() => window.importQA.choose(JSON.stringify(window.importQA.incoming), { delayed: true }));
  await page.waitForFunction(() => Boolean(window.importQA.release));
  await page.evaluate(() => { window.importQA.workspace.close(); window.importQA.release(); });
  await idle();
  assert.equal(await page.$eval('[data-role="import-review"]', (node) => node.hidden), true);
  assert.equal(await saved(), changed);
  assert.deepEqual(errors, []);
  await page.evaluate(async () => { window.importQA.workspace.destroy(); await window.importQA.recordStore.close(); });
  console.log('PASS: real IndexedDB preview/no writes, counts, cancel, explicit confirmation, stale-review rejection, invalid/oversized files, escaped filename, mobile width/focus, Escape and close during delayed file read.');
} finally {
  await browser?.close();
  clearTimeout(deadline);
}
