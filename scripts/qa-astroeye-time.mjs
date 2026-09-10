import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import puppeteer from 'puppeteer';

// A fresh, isolated profile: never reads or changes the user's browser records.
const browser = await puppeteer.launch({ headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1360, height: 1000 });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(process.env.QA_BASE_URL || 'http://127.0.0.1:5173', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#astroeye-entry-layers', { timeout: 30000 });
  const click = (selector) => page.$eval(selector, (button) => button.click());
  const text = (selector) => page.$eval(selector, (node) => node.textContent);
  await click('#astroeye-entry-layers');
  await page.waitForSelector('#astroeye-workspace:not([hidden])');
  await page.$eval('.astroeye-form', (form) => {
    const values = { title: 'Time explorer QA', sport: 'American Football', competition: 'NFL',
      home: 'QA Home', away: 'QA Away', venueName: 'QA venue', latitude: '40.7128', longitude: '-74.006',
      localDate: '2026-11-01', localTime: '01:30', timeZone: 'America/New_York', houseSystem: 'equal' };
    for (const [name, value] of Object.entries(values)) form.elements.namedItem(name).value = value;
    form.elements.namedItem('timeZone').dispatchEvent(new Event('change', { bubbles: true }));
    form.elements.namedItem('utcStart').value = '2026-11-01T06:30:00.000Z';
    form.requestSubmit();
  });
  await page.waitForSelector('.astroeye-chart:not([hidden]) svg');
  const records = () => page.evaluate(async () => {
    const open = indexedDB.open('t-rexx-world-engine');
    const db = await new Promise((resolve, reject) => { open.onsuccess = () => resolve(open.result); open.onerror = () => reject(open.error); });
    const result = {};
    for (const name of ['events', 'charts']) {
      const query = db.transaction(name, 'readonly').objectStore(name).getAll();
      result[name] = await new Promise((resolve, reject) => { query.onsuccess = () => resolve(query.result); query.onerror = () => reject(query.error); });
    }
    db.close(); return result;
  });
  const before = await records();
  assert.equal(before.events.length, 1);
  assert.equal(before.charts.length, 1);
  const originalWheel = await page.$eval('[data-chart="wheel"]', (node) => node.innerHTML);
  const originalAsc = await text('[data-chart="ascendant"]');
  const originalTitleTime = await text('[data-chart="time"]');
  await page.$eval('#astroeye-time-offset', (slider) => {
    slider.value = '-60';
    slider.dispatchEvent(new Event('input', { bubbles: true }));
  });
  assert.equal(await text('[data-chart="ascendant"]'), originalAsc, 'dragging alone does not calculate');
  await page.$eval('#astroeye-time-offset', (slider) => slider.dispatchEvent(new Event('change', { bubbles: true })));
  assert.match(await text('[data-time="instant"]'), /05:30:00 UTC/);
  assert.equal(await text('[data-time="mode"]'), 'UNSAVED PREVIEW');
  assert.equal(await text('[data-chart="time"]'), originalTitleTime, 'source header stays unchanged');
  assert.notEqual(await text('[data-chart="ascendant"]'), originalAsc);
  assert.notEqual(await page.$eval('[data-chart="wheel"]', (node) => node.innerHTML), originalWheel);
  assert.match(await text('[data-chart="provenance"]'), /equal houses.*05:30:00.000Z.*original event.*06:30:00.000Z/);
  await click('[data-action="refocus"]');
  await page.waitForFunction(() => !document.querySelector('#astroeye-workspace').dataset.busy);
  assert.equal(await text('[data-time="mode"]'), 'UNSAVED PREVIEW');
  await click('[data-action="close"]');
  await click('#astroeye-entry-layers');
  await page.waitForSelector('#astroeye-workspace:not([hidden])');
  assert.equal(await text('[data-time="offset"]'), '−60 min');
  await click('[data-action="time-forward"]');
  assert.match(await text('[data-time="instant"]'), /05:45:00 UTC/);
  await page.focus('#astroeye-time-offset');
  await page.keyboard.press('ArrowRight');
  assert.match(await text('[data-time="instant"]'), /05:46:00 UTC/);
  await click('[data-action="time-back"]');
  assert.match(await text('[data-time="instant"]'), /05:31:00 UTC/);
  mkdirSync('qa-shots/astroeye-time', { recursive: true });
  await page.$eval('.astroeye-time-explorer', (node) => node.scrollIntoView({ block: 'center' }));
  await page.screenshot({ path: 'qa-shots/astroeye-time/desktop.png' });
  await page.setViewport({ width: 390, height: 844 });
  await page.$eval('.astroeye-time-explorer', (node) => node.scrollIntoView({ block: 'center' }));
  assert.ok(await page.$eval('#astroeye-workspace', (node) => node.scrollWidth <= node.clientWidth + 1), 'no horizontal overflow at mobile width');
  await page.screenshot({ path: 'qa-shots/astroeye-time/mobile.png' });
  await page.focus('#astroeye-time-offset');
  await page.keyboard.press('End');
  assert.equal(await page.$eval('[data-action="time-forward"]', (button) => button.disabled), true);
  await page.keyboard.press('Home');
  assert.equal(await page.$eval('[data-action="time-back"]', (button) => button.disabled), true);
  await click('[data-action="time-reset"]');
  assert.equal(await text('[data-time="mode"]'), 'EVENT START');
  assert.equal(await page.$eval('[data-chart="wheel"]', (node) => node.innerHTML), originalWheel);
  await click('[data-action="time-forward"]');
  await click('[data-role="event-list"] button');
  await page.waitForFunction(() => document.querySelector('[data-time="mode"]').textContent === 'EVENT START');
  assert.deepEqual(await records(), before, 'all saved records must remain unchanged');
  assert.deepEqual(errors, []);
  console.log('PASS: preview chart, DST fold, pending slider, keyboard, bounds, reset, selection, refocus, reopen, untouched storage, desktop/mobile layouts.');
} finally {
  await browser.close();
}
