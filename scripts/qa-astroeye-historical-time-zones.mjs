import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import puppeteer from 'puppeteer';

const pack = JSON.parse(readFileSync(new URL('../src/domain/events/fixtures/historical-time-zones.json', import.meta.url), 'utf8'));
let browser;
const deadline = setTimeout(async () => {
  console.error('Historical time-zone browser check exceeded its 45-second budget.');
  await Promise.race([browser?.close(), new Promise((resolve) => setTimeout(resolve, 2000))]);
  browser?.process()?.kill(); process.exit(1);
}, 45000);
try {
  browser = await puppeteer.launch({ headless: true, timeout: 15000, args: ['--disable-gpu'] });
  const page = await browser.newPage(), base = process.env.QA_BASE_URL || 'http://127.0.0.1:5173';
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    if (request.resourceType() === 'document') void request.respond({ contentType: 'text/html', body: '<html><body></body></html>' });
    else if (new URL(request.url()).origin !== new URL(base).origin) void request.abort();
    else void request.continue();
  });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  const results = await page.evaluate(async (cases) => {
    const { resolveZonedLocalTime } = await import('/src/domain/events/eventSchema.js');
    const { describeDraftTime } = await import('/src/modules/astroeye/draftTimeSummary.js');
    return cases.map((row) => ({ id: row.id, resolved: resolveZonedLocalTime(row), summary: describeDraftTime(row),
      chosen: row.candidates.map((utcStart) => describeDraftTime({ ...row, utcStart })) }));
  }, pack.cases);
  assert.equal(results.length, 16);
  for (const [index, result] of results.entries()) {
    const expected = pack.cases[index];
    assert.equal(result.id, expected.id);
    assert.equal(result.resolved.status, expected.status, expected.id);
    assert.deepEqual(result.resolved.candidates, expected.candidates, expected.id);
    if (expected.status !== 'exact') assert.equal(result.summary.state, expected.status, expected.id);
    for (const [i, chosen] of result.chosen.entries()) {
      assert.equal(chosen.utcStart, expected.candidates[i], expected.id);
      if (expected.id === 'kathmandu-range-edge') assert.equal(chosen.state, 'out-of-range');
      else { assert.equal(chosen.state, 'ready'); assert.ok(chosen.text.includes(expected.offsets[i]), chosen.text); }
    }
  }
  assert.deepEqual(errors, []);
  console.log(`PASS: 16 IANA-derived time-zone cases and draft summaries in ${await browser.version()}; no records or user preview accessed.`);
} finally {
  try { await browser?.close(); } finally { clearTimeout(deadline); }
}
