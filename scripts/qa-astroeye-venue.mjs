import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import puppeteer from 'puppeteer';

// Synthetic records in a fresh browser; font fallback avoids third-party startup waits.
const browser = await puppeteer.launch({ headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
try {
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(60000);
  await page.setViewport({ width: 1360, height: 1000 });
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    if (['fonts.googleapis.com', 'fonts.gstatic.com'].includes(new URL(request.url()).hostname)) void request.abort();
    else void request.continue();
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const click = (selector) => page.$eval(selector, (button) => button.click());
  const text = (selector) => page.$eval(selector, (node) => node.textContent);
  const records = () => page.evaluate(() => window.__godsEyeView.worldPlatform.recordStore.serializeRecords());
  const camera = () => page.evaluate(() => window.__godsEyeView.styleManager.getCameraState());
  const base = process.env.QA_BASE_URL || 'http://127.0.0.1:5173';
  await page.goto(`${base}/#v=2&lat=40.7128&lon=-74.006&alt=12000&heading=0&pitch=-90&roll=0&style=normal&map=osm&l=`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__godsEyeView?.worldPlatform && document.querySelector('#loading-screen').classList.contains('hidden'), { timeout: 60000 });
  assert.equal(await page.$eval('#astroeye-selected-event', (node) => node.hidden), true);
  await click('#astroeye-entry-layers');
  await page.waitForSelector('#astroeye-workspace:not([hidden])');
  await page.$eval('.astroeye-form', (form) => {
    const values = { title: 'Venue QA <img src=x> 🪐', sport: 'Demo', competition: 'Demo', home: 'Home', away: 'Away',
      venueName: 'QA venue <b>plain text</b>', latitude: '40.7128', longitude: '-74.006',
      localDate: '2026-11-01', localTime: '01:30', timeZone: 'America/New_York', houseSystem: 'equal' };
    for (const [name, value] of Object.entries(values)) form.elements.namedItem(name).value = value;
    form.elements.namedItem('timeZone').dispatchEvent(new Event('change', { bubbles: true }));
    form.elements.namedItem('utcStart').value = '2026-11-01T06:30:00.000Z';
    form.requestSubmit();
  });
  await page.waitForSelector('.astroeye-chart:not([hidden]) svg');
  await page.$eval('#astroeye-time-offset', (slider) => { slider.value = '-60'; slider.dispatchEvent(new Event('change', { bubbles: true })); });
  await new Promise((resolve) => setTimeout(resolve, 3000)); // Finish the explicit venue flight.
  const before = await records();
  const pose = await camera();
  const wheel = await page.$eval('[data-chart="wheel"]', (node) => node.innerHTML);
  await click('[data-action="venue-context"]');
  await page.waitForSelector('#astroeye-venue-context:not([hidden])');
  assert.match(await text('[data-venue="eventTime"]'), /06:30:00 UTC/);
  assert.match(await text('[data-venue="chartTime"]'), /05:30:00 UTC/);
  assert.match(await text('[data-venue="method"]'), /equal houses/);
  assert.equal(await text('[data-venue="coordinates"]'), '40.71280, -74.00600');
  assert.match(await text('[data-venue="venue"]'), /<b>plain text<\/b>/);
  assert.equal(await page.$eval('#astroeye-venue-context', (node) => node.querySelectorAll('img,b,script').length), 0);
  assert.deepEqual(await camera(), pose, 'context opening does not navigate');
  mkdirSync('qa-shots/astroeye-venue', { recursive: true });
  await page.screenshot({ path: 'qa-shots/astroeye-venue/desktop.png' });
  await page.setViewport({ width: 390, height: 844 });
  assert.ok(await page.$eval('#astroeye-venue-context', (node) => node.scrollWidth <= node.clientWidth + 1));
  await page.screenshot({ path: 'qa-shots/astroeye-venue/mobile.png' });
  await page.keyboard.press('Escape');
  await page.waitForSelector('#astroeye-venue-context[hidden]');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'astroeye-selected-event');
  await page.keyboard.press('Enter');
  await page.waitForSelector('#astroeye-venue-context:not([hidden])');
  await click('[data-venue-action="chart"]');
  await page.waitForSelector('#astroeye-workspace:not([hidden])');
  assert.equal(await page.$eval('[data-chart="wheel"]', (node) => node.innerHTML), wheel);
  assert.equal(await page.evaluate(() => document.activeElement.dataset.chart), 'title');
  assert.equal(await records(), before);
  console.log('PASS: context, exact DST/preview times, plain-text provenance, keyboard, mobile and no record writes.');
  await page.setViewport({ width: 1360, height: 1000 });
  await click('[data-action="close"]');
  await page.waitForSelector('#astroeye-workspace[hidden]');
  // Actual rendered Cesium entity pick; do not call the new handler directly.
  const marker = await page.evaluate(() => {
    const { viewer } = window.__godsEyeView;
    const entity = viewer.entities.getById('t-rexx-astroeye-selected-event');
    const point = viewer.scene.cartesianToCanvasCoordinates(entity.position.getValue(viewer.clock.currentTime));
    const rect = viewer.scene.canvas.getBoundingClientRect();
    return { x: point.x + rect.left, y: point.y + rect.top };
  });
  await page.mouse.click(marker.x, marker.y);
  await page.waitForSelector('#astroeye-venue-context:not([hidden])');
  assert.match(await text('[data-venue="chartTime"]'), /05:30:00 UTC/);
  assert.equal(await records(), before);
  console.log('PASS: actual map marker click opens current context without losing the preview.');
  await click('[data-venue-action="chart"]');
  await page.waitForSelector('#astroeye-workspace:not([hidden])');
  page.once('dialog', (dialog) => dialog.accept());
  await click('[data-action="delete"]');
  await page.waitForFunction(() => document.querySelector('#astroeye-selected-event').hidden);
  assert.equal(await page.evaluate(() => Boolean(window.__godsEyeView.viewer.entities.getById('t-rexx-astroeye-selected-event'))), false);
  assert.deepEqual(errors, []);
  console.log('PASS: deleting the synthetic event clears its marker and shortcut; no page errors.');
} catch (error) {
  for (const page of await browser.pages()) console.error(await page.evaluate(() => ({
    loading: document.querySelector('.loader-status')?.textContent,
    contextHidden: document.querySelector('#astroeye-venue-context')?.hidden,
    status: document.querySelector('.astroeye-live-status')?.textContent,
  })).catch(() => 'Page unavailable'));
  throw error;
} finally { await browser.close(); }
