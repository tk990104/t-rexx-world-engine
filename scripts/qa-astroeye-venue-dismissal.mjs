import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';
import { closeOwnedBrowser } from './qa-owned-browser-cleanup.mjs';

// Only the real venue panel and synthetic in-memory callbacks; no main bootstrap.
let browser, page, report, phase = 'launch';
const watchdog = setTimeout(() => {
  process.stderr.write(`Venue dismissal QA timed out during ${phase}\n`);
  browser?.process()?.kill(); process.exit(1);
}, 60000);
try {
  browser = await puppeteer.launch({ headless: true, timeout: 15000, args: ['--disable-background-networking'] });
  page = await browser.newPage(); page.setDefaultTimeout(10000);
  const base = process.env.QA_BASE_URL || 'http://127.0.0.1:5173';
  const errors = [], unexpected = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.origin !== new URL(base).origin || url.pathname.startsWith('/api/')) {
      unexpected.push(url.pathname); void request.abort();
    } else if (request.resourceType() === 'document') {
      void request.respond({ contentType: 'text/html', body: '<html><body></body></html>' });
    } else void request.continue();
  });
  phase = 'mount';
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    const { mountVenueContextPanel } = await import('/src/modules/astroeye/venueContextPanel.js');
    const qa = { allowed: true, adds: 0, closes: 0, navigation: 0, removed: 0, resolve: null, reject: null };
    const selection = { event: { id: 'synthetic', title: 'Synthetic venue', source: { kind: 'manual' },
      venue: { name: 'Synthetic', latitude: 40, longitude: -75, coordinateSource: 'manual' },
      scheduledLocal: { date: '2026-09-19', time: '12:00', timeZone: 'UTC' }, utcStart: '2026-09-19T12:00:00.000Z' },
      chart: { calculatedFor: '2026-09-19T12:00:00.000Z', options: { houseSystem: 'equal', zodiac: 'tropical' }, positions: [], aspects: [] } };
    qa.panel = mountVenueContextPanel({ getSelection: () => selection,
      eventBus: { on: () => () => qa.removed++ }, canInteract: () => qa.allowed,
      onOpen: () => qa.panel.open(), onClose: async () => {
        qa.closes++;
        if (qa.holdClose) await new Promise(resolve => { qa.finishClose = resolve; });
        if (qa.failClose) { qa.failClose = false; throw new Error('Synthetic close failure'); }
        qa.panel.close();
      },
      onChart: () => qa.navigation++, onVenue: () => qa.navigation++,
      callouts: { count: () => qa.adds, clear: () => 0, add: () => {
        qa.adds++; return new Promise((resolve, reject) => { qa.resolve = resolve; qa.reject = reject; });
      } },
    });
    window.qa = qa;
  });
  const root = '#astroeye-venue-context', launcher = '#astroeye-selected-event';
  const close = '[data-venue-action="close"]', add = '[data-venue-action="callout"]';
  const hidden = () => page.$eval(root, el => el.hidden);
  const open = async () => { await page.focus(launcher); await page.keyboard.press('Enter'); assert.equal(await hidden(), false); };
  phase = 'Escape ownership';
  await open();
  for (const mode of ['composition', 'handled']) {
    await page.$eval('#astroeye-callout-note', (el, mode) => {
      el.focus(); const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true, isComposing: mode === 'composition' });
      if (mode === 'handled') event.preventDefault(); el.dispatchEvent(event);
    }, mode);
    assert.equal(await hidden(), false);
  }
  await page.keyboard.press('Escape');
  assert.equal(await hidden(), true);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'astroeye-selected-event');
  phase = 'pending callout dismissal';
  for (const method of ['button', 'Escape']) for (const fail of [false, true]) {
    await open();
    await page.evaluate(() => { qa.resolve = null; qa.reject = null; });
    await page.focus(add); await page.keyboard.press('Enter');
    await page.waitForFunction(() => typeof qa.resolve === 'function');
    // Other actions remain serialized while the callout is pending.
    await page.$eval('[data-venue-action="venue"]', el => el.click());
    assert.equal(await page.evaluate(() => qa.navigation), 0);
    await page.focus(close); await page.keyboard.press(method === 'button' ? 'Enter' : 'Escape');
    assert.equal(await hidden(), true);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'astroeye-selected-event');
    await page.evaluate(fail => fail ? qa.reject(new Error('Synthetic callout failure')) : qa.resolve({ label: 'Synthetic callout' }), fail);
    await page.waitForFunction(fail => document.querySelector('[data-venue-status]').textContent.includes(fail ? 'Synthetic callout failure' : 'Callout added'), {}, fail);
    assert.equal(await hidden(), true);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'astroeye-selected-event');
  }
  phase = 'host policy and close retry';
  await open();
  await page.evaluate(() => { qa.allowed = false; });
  await page.focus(close); await page.keyboard.press('Escape'); assert.equal(await hidden(), false);
  await page.evaluate(() => { qa.allowed = true; qa.failClose = true; });
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.querySelector('[data-venue-status]').textContent.includes('Synthetic close failure'));
  assert.equal(await hidden(), false);
  await page.evaluate(() => { qa.holdClose = true; qa.closeBefore = qa.closes; });
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => qa.closes - qa.closeBefore), 1);
  await page.evaluate(() => { qa.holdClose = false; qa.finishClose(); });
  await page.waitForFunction(() => document.querySelector('#astroeye-venue-context').hidden);
  phase = 'disposal during delayed completion';
  await open(); await page.focus(add); await page.keyboard.press('Enter');
  await page.evaluate(() => { qa.panel.destroy(); qa.resolve({ label: 'Late synthetic result' }); });
  assert.equal(await page.$(root), null);
  assert.equal(await page.evaluate(() => qa.removed), 3);
  assert.deepEqual(errors, []); assert.deepEqual(unexpected, []);
  report = { passed: true, pendingCalloutCloseAndEscape: true, delayedSuccessAndFailureStayClosed: true,
    hostPolicyPreserved: true, duplicateCloseSuppressed: true, failedCloseRetry: true,
    disposalSafe: true, compositionEventsSimulated: true, nativeIMEVerified: false,
    mainAppBootstrapped: false, userDataAccessed: false, liveProviderRequests: 0 };
} finally {
  phase = 'cleanup';
  try { const cleanup = await closeOwnedBrowser(browser, { page }); if (report) report.cleanup = cleanup; }
  finally { clearTimeout(watchdog); }
}
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`, () => process.exit(report?.passed && report.cleanup.status === 'graceful' ? 0 : 1));
