import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import puppeteer from 'puppeteer';

// Isolated browser profile and synthetic schedule responses. No user's records
// are read or modified. Live provider connectivity is checked separately.
const base = process.env.QA_BASE_URL || 'http://127.0.0.1:5173';
const live = process.argv.includes('--live');
const browser = await puppeteer.launch({ headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 560, height: 960 });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  if (!live) await page.setRequestInterception(true);
  if (!live) page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname === '/api/astroeye/sports') {
      const response = url.searchParams.has('venue') ? {
        venue: { name: 'QA test venue', coordinates: { latitude: 40.7128, longitude: -74.006 }, timeZoneHint: 'Eastern time' },
      } : {
        events: [{ sourceEventId: '90001', title: 'QA Away at QA Home', home: 'QA Home', away: 'QA Away', sport: 'American Football', competition: 'NFL',
          utcStart: '2026-11-01T06:30:00.000Z', venueId: '9001', venueName: 'QA test venue', city: 'New York', status: 'NS',
          source: { kind: 'provider', provider: 'thesportsdb', sourceEventId: '90001', retrievedAt: '2026-09-10T00:00:00.000Z' } }],
        retrievedAt: '2026-09-10T00:00:00.000Z', access: 'free', cached: false, skipped: 0,
      };
      void request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(response) });
    } else void request.continue();
  });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#astroeye-entry-layers', { timeout: 30000 });
  await page.$eval('#astroeye-entry-layers', (button) => button.click());
  await page.waitForSelector('#astroeye-workspace:not([hidden])');
  await page.click('[data-schedule="next"]');
  await page.waitForSelector('[data-schedule-index="0"]');
  await page.click('[data-schedule-index="0"]');
  await page.waitForFunction(() => !document.querySelector('[data-role="schedule-review"]').hidden);
  if (live) {
    const loaded = await page.evaluate(() => ({
      title: document.querySelector('[name="title"]').value,
      venue: document.querySelector('[name="venueName"]').value,
      latitude: document.querySelector('[name="latitude"]').value,
      longitude: document.querySelector('[name="longitude"]').value,
      source: document.querySelector('[data-role="schedule-origin"]').textContent,
    }));
    assert.ok(loaded.title && loaded.venue);
    console.log(JSON.stringify({ passed: true, liveSelection: loaded, saved: false }, null, 2));
  } else {
  const set = async (name, value) => page.$eval(`[name="${name}"]`, (input, nextValue) => {
    input.value = nextValue; input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
  await set('timeZone', 'America/New_York');
  assert.equal(await page.$eval('[name="localTime"]', (input) => input.value), '01:30:00');
  assert.equal(await page.$eval('[name="utcStart"]', (input) => input.value), '2026-11-01T06:30:00.000Z');
  assert.equal(await page.$eval('[name="latitude"]', (input) => input.value), '40.7128');
  assert.equal(await page.$eval('.astroeye-form', (form) => form.checkValidity()), false, 'review is required');
  await page.click('[name="scheduleReviewed"]');
  await set('venueName', 'QA reviewed venue');
  assert.equal(await page.$eval('[name="scheduleReviewed"]', (input) => input.checked), false, 'edits invalidate review');
  await page.click('[name="scheduleReviewed"]');
  await page.$eval('.astroeye-form', (form) => form.requestSubmit());
  await page.waitForSelector('.astroeye-chart:not([hidden]) svg');
  const provenance = await page.$eval('[data-chart="provenance"]', (node) => node.textContent);
  assert.match(provenance, /2026-11-01T06:30:00.000Z/);
  assert.match(provenance, /thesportsdb event 90001/);
  const record = await page.evaluate(async () => {
    const open = indexedDB.open('t-rexx-world-engine');
    const db = await new Promise((resolve, reject) => { open.onsuccess = () => resolve(open.result); open.onerror = () => reject(open.error); });
    const query = db.transaction('events', 'readonly').objectStore('events').getAll();
    const records = await new Promise((resolve, reject) => { query.onsuccess = () => resolve(query.result); query.onerror = () => reject(query.error); });
    db.close(); return records[0];
  });
  assert.equal(record.utcStart, '2026-11-01T06:30:00.000Z');
  assert.equal(record.source.provider, 'thesportsdb');
  assert.equal(record.venue.coordinateSource, 'user-reviewed');
  mkdirSync('qa-shots/astroeye-schedule', { recursive: true });
  await page.$eval('#astroeye-workspace', (node) => { node.scrollTop = 0; });
  await page.screenshot({ path: 'qa-shots/astroeye-schedule/narrow.png' });
  assert.ok(await page.$eval('#astroeye-workspace', (node) => node.scrollWidth <= node.clientWidth + 1), 'narrow panel must not overflow horizontally');
  await page.setViewport({ width: 1360, height: 1000 });
  await page.screenshot({ path: 'qa-shots/astroeye-schedule/desktop.png' });
  await page.$eval('[data-action="new"]', (button) => button.click());
  assert.equal(await page.$eval('[name="scheduleReviewed"]', (input) => input.required), false);
  assert.equal(await page.$eval('[data-role="schedule-review"]', (node) => node.hidden), true);
  assert.deepEqual(errors, [], 'no uncaught browser errors');
  console.log('PASS: schedule selection, venue fill, second DST occurrence, review invalidation, persisted provenance, responsive layouts, clear-form reset.');
  }
} finally {
  await browser.close();
}
