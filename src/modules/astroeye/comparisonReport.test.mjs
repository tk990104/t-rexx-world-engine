import assert from 'node:assert/strict';
import test from 'node:test';
import { captureComparison } from './chartComparison.js';
import { serializeComparisonReport } from './comparisonReport.js';
import { compareCrossChartAspects } from './crossChartAspects.js';

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

test('cross-chart report section is explicit opt-in and matches all displayed pairs', () => {
  const left = pin(), right = current();
  const before = JSON.stringify([left, right]);
  for (const includeAspects of [undefined, false, 'true']) {
    const report = serializeComparisonReport(left, right, { includeAspects });
    assert.doesNotMatch(report, /CROSS-CHART ASPECTS/);
    assert.match(report, /view not enabled/);
  }
  const report = serializeComparisonReport(left, right, { includeAspects: true });
  assert.match(report, /Report format: 3/);
  assert.match(report, /CROSS-CHART ASPECTS/);
  assert.match(report, /conjunction 0° ±8°/);
  assert.match(report, /No applying\/separating phase/);
  assert.match(report, /Sun \| Moon \| opposition \| 179.00° \| 1.00°/);
  assert.equal(report.split('\n').filter((line) => line.includes(' | ')).length, 14 + compareCrossChartAspects(left, right).rows.length);
  assert.equal(JSON.stringify([left, right]), before);
});

test('opted-in report distinguishes no matches from missing values and refuses incompatible charts', () => {
  const left = { ...pin(), values: { Sun: 0 } };
  const right = { ...current(), values: { Moon: 30 } };
  assert.match(serializeComparisonReport(left, right, { includeAspects: true }), /0 matches from 1 valid pairs; 143 pairs skipped/);
  assert.throws(() => serializeComparisonReport(left, { ...right, version: 'other' }, { includeAspects: true }), /unavailable/);
});

test('filtered report states its filters, exports only matching aspects and keeps 12 longitude rows', () => {
  const left = pin(), right = current();
  const report = serializeComparisonReport(left, right, { includeAspects: true, aspectFilters: { aspect: 'opposition', maxOrb: 1 } });
  const [longitudes, aspects] = report.split('CROSS-CHART ASPECTS');
  assert.equal(longitudes.split('\n').filter((line) => line.includes(' | ')).length, 13);
  assert.match(aspects, /Filters: opposition; maximum orb 1°/);
  assert.match(aspects, /Sun \| Moon \| opposition \| 179.00° \| 1.00°/);
  assert.doesNotMatch(aspects, / \| conjunction \| /);
  const expected = compareCrossChartAspects(left, right).rows.filter((row) => row.aspect === 'opposition' && row.orb <= 1);
  assert.equal(aspects.split('\n').filter((line) => line.includes(' | ')).length, 1 + expected.length);
  assert.throws(() => serializeComparisonReport(left, right, { includeAspects: true, aspectFilters: { maxOrb: -1 } }), /Maximum orb/);
  assert.doesNotMatch(serializeComparisonReport(left, right, { aspectFilters: { aspect: 'opposition', maxOrb: 1 } }), /Filters: opposition/);
});
