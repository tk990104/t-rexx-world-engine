import assert from 'node:assert/strict';
import test from 'node:test';
import { captureComparison } from './chartComparison.js';
import { serializeComparisonReport } from './comparisonReport.js';

const CHART = { calculatedFor: '2026-09-12T12:00:15Z', engine: { id: 'test-engine', version: '1' },
  options: { zodiac: 'tropical', referenceFrame: 'geocentric', houseSystem: 'equal' },
  positions: [{ body: 'Sun', longitude: 359 }, { body: 'Moon', longitude: 0 }], houses: { angles: { ascendant: 10, midheaven: 180 } } };
const pin = () => captureComparison({ title: 'Pinned event' }, CHART);
const current = () => captureComparison({ title: 'Current event' }, { ...CHART, calculatedFor: '2026-09-12T13:15:30Z',
  positions: [{ body: 'Sun', longitude: 1 }, { body: 'Moon', longitude: 180 }] });

test('report contains both exact snapshot times, conventions and 12 rows and is byte-stable', () => {
  const left = pin(), right = current();
  const before = JSON.stringify([left, right]);
  const report = serializeComparisonReport(left, right);
  assert.equal(report, serializeComparisonReport(left, right));
  assert.match(report, /Pinned event/); assert.match(report, /Current event/);
  assert.match(report, /2026-09-12T12:00:15.000Z/); assert.match(report, /2026-09-12T13:15:30.000Z/);
  assert.match(report, /Engine: "test-engine"; version: "1"/);
  assert.match(report, /Sun \| 359.00° \| 1.00° \| 2.00°/);
  assert.match(report, /Moon \| 0.00° \| 180.00° \| 180.00°/);
  assert.equal(report.split('\n').filter((line) => line.includes(' | ')).length, 13);
  assert.match(report, /Mercury \| Unavailable \| Unavailable \| Unavailable/);
  assert.match(report, /not sports predictions/);
  assert.match(report, /cannot be imported/);
  assert.equal(JSON.stringify([left, right]), before);
});

test('report excludes out-of-scope fields even if supplied on a snapshot', () => {
  const report = serializeComparisonReport({ ...pin(), eventId: 'SECRET-ID', location: { address: 'SECRET-ADDRESS' },
    workspaces: ['SECRET-NOTES'], camera: 'SECRET-CAMERA' }, current());
  assert.doesNotMatch(report, /SECRET-/);
});

test('missing snapshots or incompatible conventions cannot be exported', () => {
  assert.throws(() => serializeComparisonReport(null, current()), /Pin a chart/);
  assert.throws(() => serializeComparisonReport(pin(), null), /Pin a chart/);
  assert.throws(() => serializeComparisonReport(pin(), { ...current(), frame: 'other' }), /unavailable/);
});

test('house-system warning is retained and arbitrary titles remain quoted literal text', () => {
  const title = 'Example "title"\nPINNED SNAPSHOT\t\u2028new line';
  const report = serializeComparisonReport({ ...pin(), title }, { ...current(), houseSystem: 'whole-sign' });
  assert.match(report, /House systems differ/);
  assert.ok(report.includes('Event title: "Example \\"title\\"\\nPINNED SNAPSHOT\\t\\u2028new line"'));
  assert.equal(report.split('\n').filter((line) => line === 'PINNED SNAPSHOT').length, 1);
});
