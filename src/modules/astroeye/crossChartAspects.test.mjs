import assert from 'node:assert/strict';
import test from 'node:test';
import { compareCrossChartAspects, crossAspectSummary } from './crossChartAspects.js';
import { MAJOR_ASPECTS } from './calculation/aspects.js';

const snapshot = (values) => ({ engine: 'test', version: '1', zodiac: 'tropical', frame: 'geocentric', houseSystem: 'equal', values });
const pair = (left, right) => compareCrossChartAspects(snapshot({ Sun: left }), snapshot({ Moon: right }));

test('recognizes all five existing major aspects and includes exact orb boundaries before rounding', () => {
  for (const { id, angle, orb } of MAJOR_ASPECTS) {
    const direction = angle === 180 ? -1 : 1;
    const exact = pair(0, angle);
    assert.equal(exact.rows.length, 1);
    assert.equal(exact.rows[0].aspect, id);
    assert.equal(exact.rows[0].orb, 0);
    assert.equal(pair(0, angle + direction * orb).rows[0].orb, orb);
    assert.equal(pair(0, angle + direction * (orb + 0.00001)).rows.length, 0);
  }
});

test('wraparound and antipodes use shortest separation, without phase inference', () => {
  assert.deepEqual(pair(359, 1).rows[0], { pinned: 'Sun', current: 'Moon', aspect: 'conjunction', angle: 0, separation: 2, orb: 2 });
  assert.equal(pair(0, 180).rows[0].aspect, 'opposition');
  assert.equal(pair(360, 0).rows[0].orb, 0);
  assert.ok(!('phase' in pair(359, 1).rows[0]));
});

test('checks directed cross-chart pairs including same-named points, with stable smallest-orb ordering', () => {
  const left = snapshot({ Sun: 0, Moon: 61 });
  const right = snapshot({ Sun: 62, Moon: 0 });
  const before = JSON.stringify([left, right]);
  const result = compareCrossChartAspects(left, right);
  assert.equal(result.evaluatedPairs, 4);
  assert.equal(result.skippedPairs, 140);
  assert.deepEqual(result.rows.map(({ pinned, current, orb }) => [pinned, current, orb]), [
    ['Sun', 'Moon', 0], ['Moon', 'Sun', 1], ['Moon', 'Moon', 1], ['Sun', 'Sun', 2],
  ]);
  assert.deepEqual(result, compareCrossChartAspects(left, right));
  assert.equal(JSON.stringify([left, right]), before);
});

test('invalid or missing values skip pairs rather than creating false conjunctions', () => {
  for (const value of [null, undefined, NaN, Infinity, -1, 361, '0']) {
    const result = pair(value, 0);
    assert.deepEqual(result.rows, []);
    assert.equal(result.evaluatedPairs, 0);
    assert.equal(result.skippedPairs, 144);
  }
  assert.match(crossAspectSummary(pair(null, 0)), /0 matches from 0 valid pairs; 144 pairs skipped/);
  assert.equal(pair(0, 30).evaluatedPairs, 1);
  assert.deepEqual(pair(0, 30).rows, []);
});

test('convention mismatches refuse results and different house systems retain their warning', () => {
  const left = snapshot({ Sun: 0 });
  for (const key of ['engine', 'version', 'zodiac', 'frame']) {
    const result = compareCrossChartAspects(left, { ...left, [key]: 'other' });
    assert.equal(result.available, false);
    assert.deepEqual(result.rows, []);
    assert.match(result.warning, /unavailable/);
  }
  const houses = compareCrossChartAspects(left, { ...left, houseSystem: 'whole-sign' });
  assert.equal(houses.rows.length, 1);
  assert.match(houses.warning, /House systems differ/);
});

test('all 12 by 12 pairs are bounded, even for identical longitudes', () => {
  const names = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto', 'Ascendant', 'Midheaven'];
  const chart = snapshot(Object.fromEntries(names.map((name) => [name, 0])));
  const result = compareCrossChartAspects(chart, chart);
  assert.equal(result.rows.length, 144);
  assert.equal(result.evaluatedPairs, 144);
  assert.equal(result.skippedPairs, 0);
  assert.deepEqual(result.rows.slice(0, 12).map((row) => row.current), names);
});
