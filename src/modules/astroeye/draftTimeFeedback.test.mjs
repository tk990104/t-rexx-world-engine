import assert from 'node:assert/strict';
import test from 'node:test';
import { readSourceSync } from '../../testSupport/sourceText.mjs';
import { renderDraftTimeFeedback } from './draftTimeFeedback.js';
import { describeDraftTime } from './draftTimeSummary.js';

function fixture() {
  const fields = Object.fromEntries(['localDate', 'localTime', 'timeZone', 'utcStart'].map((name) => [name, {
    value: `unchanged-${name}`, attributes: {},
    setAttribute(key, value) { this.attributes[key] = value; },
    removeAttribute(key) { delete this.attributes[key]; },
    focus() { assert.fail('Editing must never move focus'); },
  }]));
  return { fields, form: { elements: { namedItem: (name) => fields[name] } },
    node: { dataset: {}, textContent: '', focus() { assert.fail('Rendering must never move focus'); } } };
}

for (const [state, input] of [
  ['invalid', { localDate: '2026-03-08', localTime: '02:30', timeZone: 'Mars/Olympus' }],
  ['nonexistent', { localDate: '2026-03-08', localTime: '02:30', timeZone: 'America/New_York' }],
  ['out-of-range', { localDate: '2100-12-31', localTime: '23:30', timeZone: 'America/New_York' }],
]) {
  test(`${state} draft marks the time combination and preserves values without focusing`, () => {
    const f = fixture(), summary = describeDraftTime(input);
    assert.equal(summary.state, state);
    assert.equal(renderDraftTimeFeedback(f.form, f.node, summary), summary);
    assert.equal(f.node.textContent, summary.text);
    assert.equal(f.node.dataset.state, state);
    for (const name of ['localDate', 'localTime', 'timeZone']) assert.equal(f.fields[name].attributes['aria-invalid'], 'true');
    assert.equal(f.fields.utcStart.attributes['aria-invalid'], undefined);
    for (const [name, input] of Object.entries(f.fields)) assert.equal(input.value, `unchanged-${name}`);
  });
}

test('an unresolved repeated hour marks only its explicit choice and clears after selection', () => {
  const f = fixture(), input = { localDate: '2026-11-01', localTime: '01:30', timeZone: 'America/New_York' };
  renderDraftTimeFeedback(f.form, f.node, describeDraftTime(input));
  assert.equal(f.fields.utcStart.attributes['aria-invalid'], 'true');
  assert.equal(f.fields.timeZone.attributes['aria-invalid'], undefined);
  renderDraftTimeFeedback(f.form, f.node, describeDraftTime({ ...input, utcStart: '2026-11-01T06:30:00.000Z' }));
  assert.equal(f.node.dataset.state, 'ready');
  assert.match(f.node.textContent, /Second occurrence/);
  for (const field of Object.values(f.fields)) assert.equal(field.attributes['aria-invalid'], undefined);
});

test('pending, incomplete and ready states clear stale errors without changing describedby', () => {
  const f = fixture();
  for (const field of Object.values(f.fields)) field.attributes['aria-describedby'] = 'astroeye-draft-time-summary';
  for (const state of ['pending', 'incomplete', 'ready']) {
    for (const field of Object.values(f.fields)) field.attributes['aria-invalid'] = 'true';
    renderDraftTimeFeedback(f.form, f.node, { state, text: '<b>literal feedback</b>' });
    for (const field of Object.values(f.fields)) {
      assert.equal(field.attributes['aria-invalid'], undefined);
      assert.equal(field.attributes['aria-describedby'], 'astroeye-draft-time-summary');
    }
    assert.equal(f.node.textContent, '<b>literal feedback</b>');
    assert.equal(f.node.innerHTML, undefined);
  }
});

test('the mounted form links feedback, keeps it out of tab order and focuses only rejected submissions', () => {
  const source = readSourceSync(new URL('./astroeyeWorkspace.js', import.meta.url));
  for (const name of ['localDate', 'localTime', 'timeZone', 'utcStart']) {
    assert.match(source, new RegExp(`name="${name}"[^>]*aria-describedby="astroeye-draft-time-summary"`));
  }
  assert.match(source, /id="astroeye-draft-time-summary"[^>]*tabindex="-1"[^>]*aria-atomic="true"/);
  assert.match(source, /if \(summary.state === 'out-of-range'\) \{\s*setStatus\(summary.text, 'error'\);\s*return false;/);
  const submit = source.slice(source.indexOf("form.addEventListener('submit', async"), source.indexOf('async function selectSavedEvent'));
  assert.match(submit, /if \(!refreshTimeResolution\(\)\) \{\s*root.querySelector\('\[data-role="draft-time-summary"\]'\).focus\(\);\s*return;/);
  assert.ok(submit.indexOf('refreshTimeResolution()') < submit.indexOf('controller.saveDraft(draft)'));
  assert.match(source, /renderDraftTimeFeedback\(form, node, \{ state: 'pending'/);
});
