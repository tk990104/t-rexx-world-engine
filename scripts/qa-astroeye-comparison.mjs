import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';
import { closeOwnedBrowser } from './qa-owned-browser-cleanup.mjs';

// Small comparison-only DOM test: synthetic snapshots, no globe or user storage.
let browser, page, report;
const deadline = setTimeout(() => {
  console.error('Comparison UI check exceeded its 60-second budget.');
  browser?.process()?.kill();
  process.exit(1);
}, 60000);
try {
  browser = await puppeteer.launch({ headless: true, timeout: 15000, args: ['--disable-gpu'] });
  page = await browser.newPage();
  page.setDefaultTimeout(10000);
  await page.setViewport({ width: 390, height: 844 });
  const base = process.env.QA_BASE_URL || 'http://127.0.0.1:5173';
  const errors = [], unexpected = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.origin !== new URL(base).origin || url.pathname.startsWith('/api/')) {
      unexpected.push(url.pathname); void request.abort();
    } else if (request.resourceType() === 'document') void request.respond({ contentType: 'text/html', body: '<html><body><button id="outside">Outside comparison</button><section class="astroeye-workspace"><section class="astroeye-comparison" id="comparison"></section></section></body></html>' });
    else void request.continue();
  });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    await import('/src/modules/astroeye/astroeyeWorkspace.css');
    const { mountChartComparison } = await import('/src/modules/astroeye/chartComparisonPanel.js');
    const downloads = [];
    const panel = mountChartComparison(document.querySelector('#comparison'), { downloadReport: (text) => downloads.push(text) });
    const chart = { calculatedFor: '2026-09-12T12:00:00Z', engine: { id: 'test', version: '1' },
      options: { zodiac: 'tropical', referenceFrame: 'geocentric', houseSystem: 'equal' },
      positions: [{ body: 'Sun', longitude: 0 }, { body: 'Moon', longitude: 61 }], houses: { angles: { ascendant: 180, midheaven: 90 } } };
    panel.update({ title: 'Pinned sample' }, chart);
    document.querySelector('[data-comparison="pin"]').click();
    const current = { ...chart, calculatedFor: '2026-09-12T13:00:00Z', positions: [{ body: 'Sun', longitude: 62 }, { body: 'Moon', longitude: 0 }] };
    panel.update({ title: 'Current sample' }, current);
    window.comparisonQA = { panel, chart, current, downloads, before: JSON.stringify([chart, current]) };
  });
  const selector = (name) => `[data-comparison="${name}"]`;
  const click = async (name) => { await page.focus(selector(name)); await page.keyboard.press('Enter'); };
  const choose = (name, value) => page.select(selector(name), value);
  const rows = () => page.$$eval(`${selector('aspect-table')} tbody tr`, (nodes) => nodes.map((node) => [...node.cells].map((cell) => cell.textContent)));
  const pin = await page.$eval(selector('pinned'), (node) => node.textContent);
  await click('aspects-toggle');
  const allRows = await rows();
  assert.ok(allRows.length > 1);
  await choose('aspect-kind', 'sextile'); await choose('aspect-orb', '1');
  assert.deepEqual(await rows(), allRows.filter((row) => row[2] === 'sextile' && parseFloat(row[4]) <= 1));
  assert.match(await page.$eval(selector('filter-summary'), (node) => node.textContent), /Filters: sextile; maximum orb 1°/);
  await click('export');
  const reportText = await page.evaluate(() => window.comparisonQA.downloads.at(-1));
  assert.match(reportText, /Filters: sextile; maximum orb 1°/);
  assert.equal(reportText.split('\n').filter((line) => line.includes(' | ')).length, 14 + (await rows()).length);
  assert.doesNotMatch(reportText, / \| conjunction \| /);
  await choose('aspect-kind', 'opposition'); await choose('aspect-orb', '0');
  assert.ok((await rows()).every((row) => row[2] === 'opposition' && row[4] === '0.00°'));
  await choose('aspect-kind', 'trine');
  assert.deepEqual(await rows(), []);
  assert.match(await page.$eval(selector('filter-summary'), (node) => node.textContent), /Showing 0 of/);
  await click('aspects-toggle'); await click('aspects-toggle');
  assert.equal(await page.$eval(selector('aspect-kind'), (node) => node.value), 'trine');
  await page.evaluate(() => window.comparisonQA.panel.update({ title: 'Changed preview' }, window.comparisonQA.current));
  assert.equal(await page.$eval(selector('aspect-orb'), (node) => node.value), '0');
  assert.equal(await page.$eval(selector('pinned'), (node) => node.textContent), pin);
  assert.equal(await page.$$eval(`${selector('table')} tbody tr`, (nodes) => nodes.length), 12);
  assert.equal(await page.evaluate(() => JSON.stringify([window.comparisonQA.chart, window.comparisonQA.current]) === window.comparisonQA.before), true);
  await click('reset-filters');
  assert.deepEqual(await rows(), allRows);
  assert.equal(await page.evaluate(() => document.activeElement.dataset.comparison), 'aspect-kind');
  for (const width of [390, 1280]) {
    await page.setViewport({ width, height: 844 });
    assert.ok(await page.$eval('.astroeye-aspect-filters', (node) => node.scrollWidth <= node.clientWidth + 1));
  }
  await choose('aspect-kind', 'square'); await choose('aspect-orb', '2');
  await click('clear'); await click('pin'); await click('aspects-toggle');
  assert.equal(await page.$eval(selector('aspect-kind'), (node) => node.value), 'all');
  assert.equal(await page.$eval(selector('aspect-orb'), (node) => node.value), 'standard');
  await page.evaluate(() => window.comparisonQA.panel.update({ title: 'Incompatible' }, { ...window.comparisonQA.current, engine: { id: 'other', version: '1' } }));
  assert.equal(await page.$eval(selector('aspects'), (node) => node.hidden), true);
  assert.equal(await page.$eval(selector('export'), (node) => node.disabled), true);
  await page.evaluate(() => window.comparisonQA.panel.update({ title: 'Future model' }, { ...window.comparisonQA.current, calculationVersion: 2 }));
  assert.match(await page.$eval(selector('warning'), (node) => node.textContent), /model versions/);
  assert.equal(await page.$eval(selector('table'), (node) => node.hidden), true);
  assert.equal(await page.$eval(selector('export'), (node) => node.disabled), true);
  await page.evaluate(() => window.comparisonQA.panel.update({ title: 'Legacy model' }, window.comparisonQA.current));
  assert.equal(await page.$eval(selector('export'), (node) => node.disabled), false);
  const active = () => page.evaluate(() => document.activeElement.dataset.comparison || document.activeElement.id);
  const prepare = async () => {
    await page.evaluate(() => window.comparisonQA.panel.update({ title: 'Current sample' }, window.comparisonQA.current));
    if (await page.$eval(selector('aspects'), node => node.hidden)) await click('aspects-toggle');
  };
  // A synchronous chart refresh must only recover focus that the refresh invalidates.
  for (const mode of ['missing', 'incompatible']) {
    for (const origin of ['aspect-kind', 'aspect-orb', 'reset-filters', 'export', 'aspects-toggle', 'pin', 'region']) {
      await prepare();
      await page.focus(origin === 'region' ? '.astroeye-cross-aspects' : selector(origin));
      await page.evaluate(mode => window.comparisonQA.panel.update({ title: 'Updated sample' }, mode === 'missing' ? null
        : { ...window.comparisonQA.current, engine: { id: 'other', version: '1' } }), mode);
      assert.equal(await active(), mode === 'missing' ? 'clear' : 'pin', `${mode}: focus recovery from ${origin}`);
    }
  }
  await prepare(); await page.focus(selector('aspect-kind'));
  await page.evaluate(() => window.comparisonQA.panel.update({ title: 'Compatible refresh' }, window.comparisonQA.current));
  assert.equal(await active(), 'aspect-kind');
  await page.focus('#outside');
  await page.evaluate(() => window.comparisonQA.panel.update(null, null));
  assert.equal(await active(), 'outside', 'external focus is not stolen');
  await page.evaluate(() => { document.querySelector('#comparison').hidden = true; window.comparisonQA.panel.update({ title: 'Hidden refresh' }, window.comparisonQA.current); });
  assert.equal(await active(), 'outside', 'hidden comparison does not steal focus');
  await page.evaluate(() => { document.querySelector('#comparison').hidden = false; window.comparisonQA.panel.update(null, null); });
  await click('clear');
  assert.equal(await active(), 'heading', 'clearing the last available action focuses the comparison heading');
  assert.deepEqual(await page.$eval(selector('heading'), node => ({ tabIndex: node.tabIndex,
    outline: getComputedStyle(node).outlineStyle, width: getComputedStyle(node).outlineWidth })),
  { tabIndex: -1, outline: 'solid', width: '2px' });
  assert.equal(await page.$eval(selector('pin'), node => node.disabled), true);
  await page.keyboard.down('Shift'); await page.keyboard.press('Tab'); await page.keyboard.up('Shift');
  assert.equal(await active(), 'outside', 'heading fallback does not trap keyboard navigation');
  await page.evaluate(() => window.comparisonQA.panel.destroy());
  assert.equal(await page.$eval('#comparison', (node) => node.childElementCount), 0);
  assert.deepEqual(errors, []);
  assert.deepEqual(unexpected, []);
  report = { passed: true, filtersAndReportParity: true, immutableSnapshots: true, mobileAndDesktopLayout: true,
    missingAndIncompatibleFocusRecovery: true, externalAndHiddenFocusPreserved: true,
    clearWithoutCurrentChart: true, keyboardExit: true, teardown: true,
    mainAppBootstrapped: false, userDataAccessed: false, liveProviderRequests: 0 };
} finally {
  try {
    const cleanup = await closeOwnedBrowser(browser, { page });
    if (report) report.cleanup = cleanup;
    else console.error(JSON.stringify({ cleanup }));
  } finally { clearTimeout(deadline); }
}
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`, () => process.exit(report?.passed && report.cleanup.status === 'graceful' ? 0 : 1));
