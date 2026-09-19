import assert from 'node:assert/strict';

// Install before mounting so the real client's captured fetch can deliberately
// ignore aborts. This proves the generation guard, not just network cancellation.
export function installScheduleDraftFixture(game) {
  const originalFetch = globalThis.fetch;
  const state = { hold: null, pending: [], game };
  globalThis.fetch = (input, options) => {
    const url = new URL(input, location.href);
    const kind = url.searchParams.has('venue') ? 'venue' : 'schedule';
    if (url.pathname === '/api/astroeye/sports' && state.hold === kind) {
      return new Promise((resolve, reject) => state.pending.push({ kind, signal: options.signal, resolve, reject }));
    }
    return originalFetch(input, options);
  };
  state.restore = () => { globalThis.fetch = originalFetch; };
  window.scheduleDraftQA = state;
}

export async function checkScheduleDraftConflicts(page, mark) {
  const activate = async selector => { await page.focus(selector); await page.keyboard.press('Enter'); };
  const results = '[data-schedule-index="0"]';
  const snapshot = () => page.evaluate(async () => ({
    fields: [...document.querySelector('.astroeye-form').elements].map(el => ({ name: el.name, value: el.value, checked: el.checked, required: el.required })),
    reviewHidden: document.querySelector('[data-role="schedule-review"]').hidden,
    origin: document.querySelector('[data-role="schedule-origin"]').textContent,
    records: await qa.store.serializeRecords(), navigation: qa.navigation,
  }));
  const release = async fail => {
    await page.evaluate(async fail => {
      const state = scheduleDraftQA, pending = state.pending.at(-1);
      if (fail) pending.reject(new Error('Synthetic late venue failure'));
      else pending.resolve(new Response(JSON.stringify(pending.kind === 'venue'
        ? { venue: { name: 'Late synthetic venue', coordinates: { latitude: 1, longitude: 2 } } }
        : { events: [state.game], access: 'free', retrievedAt: state.game.source.retrievedAt, skipped: 0 }), { status: 200 }));
      await new Promise(resolve => setTimeout(resolve, 0));
    }, fail);
  };
  const begin = async kind => {
    const count = await page.evaluate(kind => { scheduleDraftQA.hold = kind; return scheduleDraftQA.pending.length; }, kind);
    await activate(kind === 'venue' ? results : '[data-schedule="next"]');
    await page.waitForFunction(count => scheduleDraftQA.pending.length > count, {}, count);
  };
  mark('draft-conflicts');
  await activate('[data-schedule="next"]'); await page.waitForSelector(results);
  await activate(results); await page.waitForSelector('[data-role="schedule-review"]:not([hidden])');
  const initial = await snapshot();
  for (const field of ['title', 'localDate', 'houseSystem', 'scheduleReviewed']) for (const fail of [false, true]) {
    await begin('venue');
    if (field === 'title') {
      await page.focus('[name="title"]'); await page.type('[name="title"]', ' manual edit');
    } else {
      await page.$eval(`[name="${field}"]`, el => {
        el.focus();
        if (el.name === 'scheduleReviewed') el.checked = !el.checked;
        else el.value = el.name === 'houseSystem' ? (el.value === 'equal' ? 'whole-sign' : 'equal') : '2026-11-02';
        el.dispatchEvent(new Event('change', { bubbles: true }));
      });
    }
    assert.equal(await page.evaluate(() => scheduleDraftQA.pending.at(-1).signal.aborted), true, `${field} aborts older selection`);
    assert.equal(await page.$eval(results, el => el.disabled), false);
    const expected = await snapshot();
    await release(fail);
    assert.deepEqual(await snapshot(), expected, `${field}/${fail}: late completion preserves the complete draft`);
    assert.equal(await page.evaluate(() => document.activeElement.name), field);
    assert.match(await page.$eval('[data-schedule="status"]', el => el.textContent), /preserve your form edits/);
  }
  // Editing a form must not cancel read-only schedule discovery.
  await begin('schedule'); await page.type('[name="title"]', ' during search');
  assert.equal(await page.evaluate(() => scheduleDraftQA.pending.at(-1).signal.aborted), false);
  const searching = await snapshot(); await release(false);
  await page.waitForSelector(results); assert.deepEqual(await snapshot(), searching);
  // A fresh explicit selection still authorizes replacement and review handoff.
  await begin('venue'); await release(false);
  await page.waitForFunction(() => document.querySelector('[name="venueName"]').value === 'Late synthetic venue');
  assert.equal(await page.evaluate(() => document.activeElement.name), 'timeZone');
  const retried = await snapshot();
  assert.equal(retried.records, initial.records); assert.equal(retried.navigation, initial.navigation);
  assert.equal(await page.$eval('[name="scheduleReviewed"]', el => el.required && !el.checked), true);
  return { cases: 8, lateSuccessAndFailurePreserveDraft: true, scheduleDiscoveryUnaffected: true, explicitRetryWorks: true, savedRecordsUnchanged: true };
}
