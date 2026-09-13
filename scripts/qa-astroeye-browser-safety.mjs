import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

// Real Chromium download/leave behavior; synthetic records, fresh browser, no live globe.
let browser;
const deadline = setTimeout(async () => {
  console.error('Browser safety check exceeded its 60-second budget.');
  await Promise.race([browser?.close(), new Promise((resolve) => setTimeout(resolve, 2000))]);
  browser?.process()?.kill(); process.exit(1);
}, 60000);
try {
  const output = fileURLToPath(new URL('../output/', import.meta.url));
  await mkdir(output, { recursive: true });
  const downloads = await mkdtemp(join(output, 'browser-safety-'));
  browser = await puppeteer.launch({ headless: true, timeout: 15000, args: ['--disable-gpu'] });
  const cdp = await browser.target().createCDPSession();
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads, eventsEnabled: true });
  const page = await browser.newPage(); page.setDefaultTimeout(10000);
  const base = process.env.QA_BASE_URL || 'http://127.0.0.1:5173';
  const errors = []; const dialogs = [];
  let dialogAction = null, dialogCompleted;
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('dialog', async (dialog) => {
    try {
      dialogs.push(dialog.type());
      if (dialog.type() !== 'beforeunload' || !dialogAction) errors.push(`Unexpected dialog: ${dialog.type()}`);
      if (dialogAction === 'accept') await dialog.accept(); else await dialog.dismiss();
      dialogCompleted?.();
    } catch (error) { errors.push(error.message); }
  });
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    if (request.resourceType() === 'document') void request.respond({ contentType: 'text/html', body: '<html><body><section id="notes"></section><section id="comparison"></section><a id="leave" href="/qa-synthetic-destination">Leave test page</a></body></html>' });
    else if (new URL(request.url()).origin !== new URL(base).origin) void request.abort();
    else void request.continue();
  });
  async function setup() {
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.evaluate(async () => {
      const { mountResearchNotebook } = await import('/src/modules/astroeye/researchNotebookPanel.js');
      const { mountChartComparison } = await import('/src/modules/astroeye/chartComparisonPanel.js');
      const { captureComparison } = await import('/src/modules/astroeye/chartComparison.js');
      const { serializeComparisonReport } = await import('/src/modules/astroeye/comparisonReport.js');
      let saved = null;
      const notes = mountResearchNotebook(document.querySelector('#notes'), { notebook: {
        load: async () => saved, save: async (text) => { saved = { text }; return saved; },
      } });
      notes.open();
      const panel = mountChartComparison(document.querySelector('#comparison'));
      const event = { title: 'Synthetic game' };
      const chart = { calculatedFor: '2026-09-12T12:00:15Z', engine: { id: 'test', version: '1' },
        options: { zodiac: 'tropical', referenceFrame: 'geocentric', houseSystem: 'equal' },
        positions: [{ body: 'Sun', longitude: 359 }, { body: 'Moon', longitude: 0 }] };
      panel.update(event, chart); document.querySelector('[data-comparison="pin"]').click();
      const current = { ...chart, calculatedFor: '2026-09-12T13:15:30Z', positions: [{ body: 'Sun', longitude: 1 }, { body: 'Moon', longitude: 180 }] };
      panel.update(event, current);
      window.safetyQA = { saved: () => saved, expectedReport: serializeComparisonReport(captureComparison(event, chart), captureComparison(event, current)) };
    });
    await page.waitForFunction(() => !document.querySelector('#notes textarea').disabled);
  }
  async function download(selector, filename, expected) {
    let guid, timer, begin, progress;
    const done = new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new Error(`Download timed out: ${filename}`)), 10000);
      begin = (event) => {
        if (event.suggestedFilename !== filename) return reject(new Error(`Unexpected filename: ${event.suggestedFilename}`));
        guid = event.guid;
      };
      progress = (event) => {
        if (event.guid !== guid) return;
        if (event.state === 'completed') resolve();
        if (event.state === 'canceled') reject(new Error(`Download canceled: ${filename}`));
      };
      cdp.on('Browser.downloadWillBegin', begin); cdp.on('Browser.downloadProgress', progress);
    });
    try {
      await Promise.all([done, page.click(selector)]);
      assert.equal(await readFile(join(downloads, filename), 'utf8'), expected);
    } finally {
      clearTimeout(timer); cdp.off('Browser.downloadWillBegin', begin); cdp.off('Browser.downloadProgress', progress);
    }
  }
  async function leaveWithDialog(action) {
    dialogAction = action;
    let timer;
    const done = new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new Error('Expected native beforeunload dialog did not appear')), 10000);
      dialogCompleted = resolve;
    });
    try { await Promise.all([done, page.click('#leave')]); }
    finally { clearTimeout(timer); dialogCompleted = null; dialogAction = null; }
  }
  await setup();
  // Real input grants the activation needed for Chromium's leave warning.
  const draft = '  Synthetic unsaved notes 🌍\n[AstroEye chart reference]\nEvent: "Demo"\n';
  await page.type('#notes textarea', draft);
  await download('[data-note="download"]', 't-rexx-research-note-draft.txt', draft);
  assert.equal(await page.evaluate(() => window.safetyQA.saved()), null);
  assert.equal(await page.$eval('#notes textarea', (node) => node.value), draft);
  assert.equal(await page.$eval('[data-note="save"]', (node) => node.disabled), false);
  const report = await page.evaluate(() => window.safetyQA.expectedReport);
  await download('[data-comparison="export"]', 't-rexx-chart-comparison.txt', report);
  assert.match(report, /2026-09-12T12:00:15.000Z/); assert.match(report, /2026-09-12T13:15:30.000Z/);
  assert.equal(dialogs.length, 0);
  const originalUrl = page.url();
  await leaveWithDialog('dismiss');
  assert.equal(page.url(), originalUrl);
  assert.equal(await page.$eval('#notes textarea', (node) => node.value), draft);
  assert.deepEqual(dialogs, ['beforeunload']);
  await page.click('[data-note="save"]');
  await page.waitForFunction(() => document.querySelector('[data-note="status"]').textContent.startsWith('Notes saved'));
  await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded' }), page.click('#leave')]);
  assert.equal(dialogs.length, 1); // Successful save removes the warning.
  await setup(); await page.type('#notes textarea', 'Synthetic draft deliberately discarded by this test.');
  const navigated = page.waitForNavigation({ waitUntil: 'domcontentloaded' });
  await Promise.all([navigated, leaveWithDialog('accept')]);
  assert.ok(page.url().endsWith('/qa-synthetic-destination'));
  assert.deepEqual(dialogs, ['beforeunload', 'beforeunload']);
  assert.deepEqual(errors, []);
  console.log('PASS: actual draft/report files match expected UTF-8 contents; downloads leave notes unsaved; real Chromium leave warning cancels without loss, clears after save and permits explicitly accepted navigation.');
  console.log(`Browser: ${await browser.version()}`);
  console.log(`Synthetic test downloads: ${downloads}`);
} finally { await browser?.close(); clearTimeout(deadline); }
