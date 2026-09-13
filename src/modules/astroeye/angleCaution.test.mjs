import assert from 'node:assert/strict';
import test from 'node:test';
import { needsAngleCaution, renderAngleCaution, HIGH_LATITUDE_ANGLE_CAUTION } from './angleCaution.js';
import { calculateAnglesFromOrientation } from './calculation/houses.js';
import { captureComparison, compareCharts } from './chartComparison.js';
import { serializeComparisonReport } from './comparisonReport.js';

const chart = (latitude) => ({ calculatedFor: '2026-09-13T00:00:00Z', location: { latitude, longitude: 12.345678 },
  engine: { id: 'test', version: '1' }, options: { zodiac: 'tropical', referenceFrame: 'geocentric', houseSystem: 'equal' },
  positions: [{ body: 'Sun', longitude: 0 }], houses: { angles: { ascendant: 180, midheaven: 90 } } });

test('conservative caution covers both latitude boundaries without coercing missing metadata', () => {
  for (const lat of [66, -66, 80, -80, 90, -90]) assert.equal(needsAngleCaution(chart(lat)), true);
  for (const lat of [65.999, -65.999, 0, 91, null, undefined, NaN, Infinity, '80']) assert.equal(needsAngleCaution(chart(lat)), false);
  assert.equal(needsAngleCaution({}), false);
});

test('chart caution clears stale text and does not mutate chart data', () => {
  const node = { hidden: true, textContent: '' }, source = chart(80), before = JSON.stringify(source);
  renderAngleCaution(node, source);
  assert.equal(node.hidden, false); assert.equal(node.textContent, HIGH_LATITUDE_ANGLE_CAUTION);
  renderAngleCaution(node, chart(40));
  assert.equal(node.hidden, true); assert.equal(node.textContent, '');
  assert.equal(JSON.stringify(source), before);
});

test('pin freezes caution without copying coordinates; reports retain side and house warnings', () => {
  const source = chart(-80), event = { title: 'Synthetic' };
  const pinned = captureComparison(event, source);
  source.location.latitude = 40;
  assert.equal(pinned.highLatitudeCaution, true);
  assert.equal(pinned.location, undefined);
  const current = captureComparison(event, { ...chart(40), options: { ...chart(40).options, houseSystem: 'whole-sign' } });
  const result = compareCharts(pinned, current);
  assert.equal(result.rows.length, 12);
  assert.match(result.warning, /House systems differ/);
  assert.match(result.warning, /Pinned snapshot — High-latitude/);
  assert.doesNotMatch(result.warning, /Current chart — High-latitude/);
  const report = serializeComparisonReport(pinned, current, { includeAspects: true });
  assert.ok(report.includes(HIGH_LATITUDE_ANGLE_CAUTION));
  assert.ok(!report.includes('12.345678'));
  assert.match(compareCharts(current, pinned).warning, /Current chart — High-latitude/);
  assert.equal(captureComparison(event, source).highLatitudeCaution, undefined);
});

test('known polar branch defect is reproduced geometrically, not certified as correct', () => {
  const rad = (value) => value * Math.PI / 180;
  for (const [latitude, theta] of [[80, 270], [-80, 90]]) {
    const angles = calculateAnglesFromOrientation(theta, latitude, 23.44, { calculationVersion: 1 });
    const l = rad(angles.ascendant), t = rad(theta), e = rad(23.44);
    const east = -Math.cos(l) * Math.sin(t) + Math.sin(l) * Math.cos(e) * Math.cos(t);
    assert.ok(east < -0.99, 'legacy model 1 retains its known western intersection for reproducible replay');
    assert.equal(needsAngleCaution(chart(latitude)), true);
  }
});

test('coincident-plane cases fall inside the caution boundary', () => {
  const rad = (value) => value * Math.PI / 180;
  for (const [latitude, theta] of [[66.56, 270], [-66.56, 90]]) {
    const p = rad(latitude), t = rad(theta), e = rad(23.44);
    const intersectionMagnitude = Math.hypot(Math.cos(t) * Math.cos(p), Math.sin(t) * Math.cos(e) * Math.cos(p) + Math.sin(p) * Math.sin(e));
    assert.ok(intersectionMagnitude < 1e-12, 'no numerically unique horizon intersection at this constructed orientation');
    assert.equal(needsAngleCaution(chart(latitude)), true);
  }
});
