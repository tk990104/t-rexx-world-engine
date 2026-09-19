import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';
import { closeOwnedBrowser } from './qa-owned-browser-cleanup.mjs';

// Real schedule panel, held synthetic callbacks, no application storage or APIs.
let browser, page, report, phase = 'launch';
const watchdog = setTimeout(() => {
  console.error(`Schedule focus check exceeded 60 seconds during ${phase}`);
  browser?.process()?.kill(); process.exit(1);
}, 60000);
try {
  browser = await puppeteer.launch({ headless: true, timeout: 15000, args: ['--disable-background-networking'] });
  page = await browser.newPage(); page.setDefaultTimeout(10000);
  const base = new URL(process.env.QA_BASE_URL || 'http://127.0.0.1:5173');
  const errors = [], unexpected = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = new URL(request.url());
    // Chromium's native date input supplies its calendar icon as an inline image.
    if (url.protocol === 'data:' && request.resourceType() === 'image' && url.pathname.startsWith('image/svg+xml;base64,')) return void request.continue();
    if (url.origin !== base.origin || url.pathname.startsWith('/api/')) {
      unexpected.push(url.pathname); void request.abort();
    } else if (request.resourceType() === 'document') void request.respond({ contentType: 'text/html',
      body: '<!doctype html><html><body><div class="astroeye-workspace" id="workspace"><section class="astroeye-schedule" id="schedule"></section><input id="zone" aria-label="Review time zone"><button id="outside">Other action</button></div></body></html>' });
    else void request.continue();
  });
  phase = 'mount';
  await page.goto(base.href, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    await import('/src/modules/astroeye/astroeyeWorkspace.css');
    const { mountSportsSchedulePanel } = await import('/src/modules/astroeye/sportsSchedulePanel.js');
    const qa = { calls: [], selections: 0 };
    const held = (kind, value, signal) => new Promise((resolve, reject) => qa.calls.push({ kind, value, signal, resolve, reject }));
    qa.response = { events: [{ title: 'Synthetic game', utcStart: '2026-09-19T12:00:00.000Z', venueId: 'synthetic', venueName: 'Synthetic venue', status: 'NS' }],
      retrievedAt: '2026-09-19T12:00:00.000Z', access: 'free', cached: false, skipped: 0 };
    qa.panel = mountSportsSchedulePanel(document.querySelector('#schedule'), {
      focusHost: document.querySelector('#workspace'),
      client: { schedule: (value, signal) => held('schedule', value, signal), venue: (value, signal) => held('venue', value, signal) },
      onSelect: () => { qa.selections++; return document.querySelector('#zone'); },
    });
    window.qa = qa;
  });
  const selector = name => `[data-schedule="${name}"]`;
  const active = () => page.evaluate(() => document.activeElement.dataset.schedule || document.activeElement.id);
  const activate = async target => { await page.focus(target); await page.keyboard.press('Enter'); };
  const settle = async (kind = 'success') => {
    await page.evaluate(kind => {
      const call = qa.calls.at(-1);
      if (kind === 'failure') call.reject(new Error('Synthetic lookup failure'));
      else call.resolve(call.kind === 'venue' ? { venue: { name: 'Synthetic venue' } }
        : { ...qa.response, events: kind === 'empty' ? [] : qa.response.events });
    }, kind);
    await page.waitForFunction(() => !document.querySelector('[data-schedule="next"]').disabled);
  };
  phase = 'schedule success empty and failure';
  for (const action of ['next', 'day']) for (const outcome of ['success', 'empty', 'failure']) {
    await activate(selector(action));
    assert.equal(await page.$eval(selector(action), el => el.disabled), true);
    await settle(outcome);
    assert.equal(await active(), action, `${action}/${outcome} restores its enabled origin`);
    assert.equal(await page.$eval(selector(action), el => getComputedStyle(el).outlineStyle), 'solid');
  }
  phase = 'released and hidden focus';
  await activate(selector('next')); await page.focus('#outside'); await settle();
  assert.equal(await active(), 'outside');
  await activate(selector('next'));
  await page.evaluate(() => { document.querySelector('#schedule').hidden = true; });
  await settle(); assert.notEqual(await active(), 'next');
  await page.evaluate(() => { document.querySelector('#schedule').hidden = false; });
  phase = 'review handoff';
  const result = '[data-schedule-index="0"]';
  for (const outcome of ['success', 'failure']) {
    await activate(result); await settle(outcome);
    assert.equal(await active(), 'zone', 'review handoff remains available with missing venue details');
  }
  await activate(result); await page.focus('#outside'); await settle();
  assert.equal(await active(), 'outside', 'late venue completion does not steal later focus');
  await page.$eval(result, el => el.click()); await settle();
  assert.equal(await active(), 'outside', 'programmatic action does not acquire external focus ownership');
  phase = 'cancel and stale completion';
  await activate(result);
  const selections = await page.evaluate(() => { qa.stale = qa.calls.at(-1); qa.panel.cancel(); return qa.selections; });
  assert.equal(await page.evaluate(() => qa.stale.signal.aborted), true);
  await activate(selector('next'));
  await page.evaluate(() => qa.stale.resolve({ venue: { name: 'Stale venue' } }));
  assert.equal(await page.evaluate(() => qa.selections), selections);
  assert.equal(await page.$eval(selector('next'), el => el.disabled), true, 'stale finally must not enable the replacement request');
  await settle(); assert.equal(await active(), 'next');
  phase = 'destroy pending operation';
  await activate(result);
  const beforeDestroy = await page.evaluate(() => {
    qa.panel.destroy(); qa.panel.destroy();
    return { calls: qa.calls.length, selections: qa.selections, status: document.querySelector('[data-schedule="status"]').textContent };
  });
  assert.equal(await page.evaluate(() => qa.calls.at(-1).signal.aborted), true);
  await page.focus('#outside'); await settle();
  await page.$eval(selector('next'), el => el.click());
  assert.deepEqual(await page.evaluate(() => ({ calls: qa.calls.length, selections: qa.selections,
    status: document.querySelector('[data-schedule="status"]').textContent })), beforeDestroy);
  assert.equal(await active(), 'outside');
  assert.deepEqual(errors, []); assert.deepEqual(unexpected, []);
  report = { passed: true, successfulEmptyAndFailedLookupFocus: true, guardedReviewHandoff: true,
    cancellationAndStaleCompletion: true, disposalRemovesInteraction: true,
    mainAppBootstrapped: false, userDataAccessed: false, liveProviderRequests: 0 };
} finally {
  phase = 'cleanup';
  try {
    const cleanup = await closeOwnedBrowser(browser, { page });
    if (report) report.cleanup = cleanup; else console.error(JSON.stringify({ cleanup }));
  } finally { clearTimeout(watchdog); }
}
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`, () => process.exit(report?.passed && report.cleanup.status === 'graceful' ? 0 : 1));
