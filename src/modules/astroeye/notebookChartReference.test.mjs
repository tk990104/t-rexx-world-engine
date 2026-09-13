import assert from 'node:assert/strict';
import test from 'node:test';
import { createNotebookChartReference, appendNotebookChartReference } from './notebookChartReference.js';

const event = { title: 'Sample "event"\nFalse heading\u2028test', utcStart: '2026-09-12T12:00:00Z', id: 'SECRET-ID', venue: { address: 'SECRET-ADDRESS' } };
const chart = { calculatedFor: '2026-09-12T12:15:30Z', engine: { id: 'test', version: '1' },
  options: { zodiac: 'tropical', referenceFrame: 'geocentric', houseSystem: 'equal' }, private: 'SECRET-EXTRA' };

test('reference freezes exact displayed chart time, conventions and quoted title, excluding unrelated fields', () => {
  const before = JSON.stringify([event, chart]);
  const reference = createNotebookChartReference(event, chart);
  assert.match(reference, /2026-09-12T12:15:30.000Z/);
  assert.doesNotMatch(reference, /2026-09-12T12:00:00|SECRET-/);
  assert.match(reference, /Engine: "test"; version: "1"/);
  assert.match(reference, /House system: "equal"/);
  assert.ok(reference.includes('Event: "Sample \\"event\\"\\nFalse heading\\u2028test"'));
  assert.match(reference, /Not a chart backup or live link/);
  assert.equal(JSON.stringify([event, chart]), before);
  assert.equal(reference, createNotebookChartReference(event, chart));
});

test('append preserves the entire existing draft and inserts only at the end', () => {
  const reference = createNotebookChartReference(event, chart);
  assert.equal(appendNotebookChartReference('', reference), `${reference}\n`);
  assert.equal(appendNotebookChartReference('Keep my draft\n', reference), `Keep my draft\n\n\n${reference}\n`);
});

test('capacity is checked on the whole appended result without truncation', () => {
  const reference = createNotebookChartReference(event, chart);
  const fits = 'x'.repeat(10000 - reference.length - 3);
  assert.equal(appendNotebookChartReference(fits, reference).length, 10000);
  assert.throws(() => appendNotebookChartReference(`${fits}x`, reference), /nothing was appended/);
  assert.throws(() => appendNotebookChartReference('draft', ''), /required/);
});

test('invalid chart metadata or time cannot yield a partial reference', () => {
  assert.throws(() => createNotebookChartReference(event, { ...chart, calculatedFor: 'invalid' }), /chart time/);
  assert.throws(() => createNotebookChartReference(event, { ...chart, engine: {} }), /engine/);
  assert.throws(() => createNotebookChartReference({}, chart), /event title/);
});
