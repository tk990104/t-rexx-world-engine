import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import puppeteer from 'puppeteer';

// Sender and recipient both use fresh isolated profiles, never user records or clipboard.
const base = process.env.QA_BASE_URL || 'http://127.0.0.1:5173';
const eventSky = process.argv.includes('--event-sky');
const browser = await puppeteer.launch({ headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const errors = [];
async function newPage() {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.setViewport({ width: 1360, height: 1000 });
  page.on('pageerror', (error) => errors.push(error.message));
  return page;
}
const click = (page, selector) => page.$eval(selector, (button) => button.click());
const text = (page, selector) => page.$eval(selector, (node) => node.textContent);
const records = (page) => page.evaluate(() => window.__godsEyeView.worldPlatform.recordStore.serializeRecords());
const worldParams = (page) => page.evaluate(() => Object.fromEntries(new URLSearchParams(
  new URL(window.__godsEyeView.styleManager.shareLinkManager.createLink()).hash.slice(1))));

try {
  const sender = await newPage();
  await sender.goto(`${base}/#v=2&lat=40&lon=-74&alt=10000&heading=12&pitch=-42&roll=0&style=normal&map=osm&l=h`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sender.waitForFunction(() => window.__godsEyeView?.worldPlatform && document.querySelector('#loading-screen').classList.contains('hidden'), { timeout: 60000 });
  await click(sender, '#astroeye-entry-layers');
  await sender.waitForSelector('#astroeye-workspace:not([hidden])');
  await sender.$eval('.astroeye-form', (form) => {
    const values = { title: 'São Paulo 🪐 Shared QA', sport: 'Football', competition: 'Demo', home: 'Home', away: 'Away',
      venueName: 'QA shared venue', latitude: '40.7128', longitude: '-74.006', localDate: '2026-11-01', localTime: '01:30',
      timeZone: 'America/New_York', houseSystem: 'equal' };
    for (const [name, value] of Object.entries(values)) form.elements.namedItem(name).value = value;
    form.elements.namedItem('timeZone').dispatchEvent(new Event('change', { bubbles: true }));
    form.elements.namedItem('utcStart').value = '2026-11-01T06:30:00.000Z';
    form.requestSubmit();
  });
  await sender.waitForSelector('.astroeye-chart:not([hidden]) svg');
  await sender.$eval('#astroeye-time-offset', (slider) => { slider.value = '-60'; slider.dispatchEvent(new Event('change', { bubbles: true })); });
  // Wait for the venue fly-to to finish before capturing the shared camera pose.
  await new Promise((resolve) => setTimeout(resolve, 3000));
  const senderRecords = await records(sender);
  const expectedWheel = await sender.$eval('[data-chart="wheel"]', (node) => node.innerHTML);
  if (eventSky) {
    const liveBefore = await sender.evaluate(() => window.__godsEyeView.viewer.clock.currentTime.toString());
    await click(sender, '[data-action="event-sky"]');
    await sender.waitForFunction(() => window.__godsEyeView.styleManager.celestialRing.visible, { timeout: 30000 });
    const ringBefore = await sender.evaluate(() => window.__godsEyeView.styleManager.celestialRing.getDirectionSnapshot());
    assert.equal(ringBefore.time, '2026-11-01T05:30:00.000Z');
    const updates = await sender.evaluate(() => window.__godsEyeView.styleManager.celestialRing.getDebugState().ephemerisUpdates);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    assert.equal(await sender.evaluate(() => window.__godsEyeView.styleManager.celestialRing.getDebugState().ephemerisUpdates), updates);
    await click(sender, '[data-action="time-forward"]');
    const shifted = await sender.evaluate(() => window.__godsEyeView.styleManager.celestialRing.getDirectionSnapshot());
    assert.equal(shifted.time, '2026-11-01T05:45:00.000Z');
    assert.notDeepEqual(shifted.sun, ringBefore.sun);
    assert.equal(await sender.evaluate(() => window.__godsEyeView.viewer.clock.currentTime.toString()), liveBefore);
    await click(sender, '[data-action="time-back"]');
    await click(sender, '[data-action="full-chart"]');
  }
  await click(sender, '[data-action="share-view"]');
  const link = await sender.$eval('#astroeye-view-link', (input) => input.value);
  const expectedWorld = Object.fromEntries(new URLSearchParams(new URL(link).hash.slice(1)));
  assert.ok(expectedWorld.ae);
  assert.equal(expectedWorld.l, 'h');
  assert.match(await text(sender, '[data-role="share-host-note"]'), /Local preview address/);
  assert.equal((await worldParams(sender)).ae, undefined, 'ordinary world links must not include event details');
  await sender.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('Denied in QA'); } } }));
  await click(sender, '[data-action="copy-view"]');
  await sender.waitForFunction(() => document.querySelector('.astroeye-live-status').textContent.includes('copy it manually'));
  assert.ok(await sender.$eval('#astroeye-view-link', (input) => input.selectionEnd === input.value.length));
  await sender.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (value) => { window.__copiedShare = value; } } }));
  await click(sender, '[data-action="copy-view"]');
  assert.equal(await sender.evaluate(() => window.__copiedShare), link);
  console.log('Sender link and clipboard checks passed.');

  const recipient = await newPage();
  await recipient.goto(link, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await recipient.waitForSelector('.astroeye-chart:not([hidden]) svg', { timeout: 60000 });
  assert.equal(await text(recipient, '[data-chart="title"]'), 'São Paulo 🪐 Shared QA');
  assert.equal(await recipient.$eval('[data-chart="wheel"]', (node) => node.innerHTML), expectedWheel);
  assert.match(await text(recipient, '[data-time="instant"]'), /05:30:00 UTC/);
  assert.match(await text(recipient, '[data-role="share-notice"]'), /not saved/);
  assert.equal(await recipient.$eval('[data-action="delete"]', (button) => button.hidden), true);
  const clock = await recipient.evaluate(() => window.__godsEyeView.worldPlatform.worldClock.snapshot());
  assert.equal(clock.mode, 'replay'); assert.equal(clock.time, '2026-11-01T05:30:00.000Z');
  const actualWorld = await worldParams(recipient);
  for (const key of ['lat', 'lon', 'alt', 'heading', 'pitch', 'roll', 'style', 'map', 'l']) {
    assert.equal(actualWorld[key], expectedWorld[key], `restored world field ${key}`);
  }
  assert.equal(await recipient.evaluate(() => window.__godsEyeView.dataManager.isEnabled('airports')), true);
  assert.equal(JSON.parse(await records(recipient)).events.length, 0);
  if (eventSky) {
    await recipient.waitForFunction(() => window.__godsEyeView.styleManager.celestialRing.visible);
    assert.equal(await recipient.evaluate(() => window.__godsEyeView.styleManager.celestialRing.getDirectionSnapshot().time), clock.time);
    mkdirSync('qa-shots/astroeye-sky', { recursive: true });
    await recipient.screenshot({ path: 'qa-shots/astroeye-sky/desktop.png' });
    await click(recipient, '[data-action="full-chart"]');
  }
  await click(recipient, '[data-action="save-shared"]');
  await recipient.waitForFunction(() => document.querySelector('[data-role="share-notice"]').hidden);
  const saved = JSON.parse(await records(recipient));
  assert.equal(saved.events.length, 1); assert.equal(saved.charts.length, 1);
  assert.notEqual(saved.events[0].id, JSON.parse(senderRecords).events[0].id);
  assert.equal(saved.events[0].utcStart, '2026-11-01T06:30:00.000Z');
  assert.equal(saved.charts[0].calculatedFor, saved.events[0].utcStart);
  assert.match(await text(recipient, '[data-time="instant"]'), /05:30:00 UTC/);
  assert.equal(await records(sender), senderRecords);
  console.log('Fresh recipient restored world/chart/time; explicit save-copy passed.');

  // A malformed link can restore ordinary world state but never partially apply AstroEye.
  const malformed = new URL(link);
  const badParams = new URLSearchParams(malformed.hash.slice(1)); badParams.set('ae', 'bad'); malformed.hash = badParams.toString();
  const savedBeforeBadLink = await records(recipient);
  await recipient.goto('about:blank'); // Force startup; fragment-only navigation is same-document.
  await recipient.goto(malformed.href, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await recipient.waitForFunction(() => document.querySelector('[data-role="share-notice"]')?.textContent.includes('not restored'), { timeout: 60000 });
  assert.equal(await recipient.$eval('.astroeye-chart', (node) => node.hidden), true);
  assert.equal(await records(recipient), savedBeforeBadLink);
  assert.equal(await recipient.evaluate(() => window.__godsEyeView.worldPlatform.worldClock.mode), 'live');

  console.log('Malformed-link rejection and existing-record preservation passed.');
  await recipient.goto('about:blank');
  await recipient.goto(link, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await recipient.waitForSelector('.astroeye-chart:not([hidden]) svg', { timeout: 60000 });
  await click(recipient, '[data-action="share-view"]');
  mkdirSync('qa-shots/astroeye-share', { recursive: true });
  await recipient.$eval('[data-role="share-notice"]', (node) => node.scrollIntoView({ block: 'center' }));
  await recipient.screenshot({ path: 'qa-shots/astroeye-share/desktop.png' });
  await recipient.setViewport({ width: 390, height: 844 });
  await recipient.$eval('.astroeye-share-controls', (node) => node.scrollIntoView({ block: 'center' }));
  assert.ok(await recipient.$eval('#astroeye-workspace', (node) => node.scrollWidth <= node.clientWidth + 1));
  await recipient.screenshot({ path: 'qa-shots/astroeye-share/mobile.png' });
  if (eventSky) {
    await click(recipient, '[data-action="full-chart"]');
    await click(recipient, '[data-action="close"]');
    assert.equal(await recipient.evaluate(() => window.__godsEyeView.styleManager.celestialRing.getDirectionSnapshot()), null);
    console.log('PASS: event sky directions, clock isolation, cached rendering, shared-sky restore and cleanup.');
  }
  assert.deepEqual(errors, []);
  console.log('PASS: isolated recipient restores chart, DST preview, clock, camera and airports; explicit save-copy; malformed-link protection; Unicode; clipboard fallback; responsive layout.');
} catch (error) {
  for (const context of browser.browserContexts()) {
    for (const page of await context.pages()) {
      console.log('QA diagnostic', await page.evaluate(() => ({
        loading: document.querySelector('.loader-status')?.textContent,
        status: document.querySelector('.astroeye-live-status')?.textContent,
        notice: document.querySelector('[data-role="share-notice"]')?.textContent,
        chartHidden: document.querySelector('.astroeye-chart')?.hidden,
        clock: window.__godsEyeView?.worldPlatform.worldClock.snapshot(),
      })).catch(() => 'page unavailable'));
    }
  }
  throw error;
} finally { await browser.close(); }
