import assert from 'node:assert/strict';
import test from 'node:test';
import { captureComparison, compareCharts } from './chartComparison.js';

const EVENT = { id: 'one', title: 'Event one' };
const CHART = { calculatedFor: '2026-09-12T12:00:15Z', engine: { id: 'test-engine', version: '1' },
  options: { zodiac: 'tropical', referenceFrame: 'geocentric', houseSystem: 'equal' },
  positions: [{ body: 'Sun', longitude: 359 }, { body: 'Moon', longitude: 0 }], houses: { angles: { ascendant: 10, midheaven: 180 } } };

test('pin captures immutable values and the chart instant rather than the event start', () => {
  const event = { ...EVENT, utcStart: '2026-09-12T12:00:00Z' };
  const chart = structuredClone(CHART);
  const pin = captureComparison(event, chart);
  event.title = 'Changed'; chart.positions[0].longitude = 100; chart.options.houseSystem = 'whole-sign';
  assert.equal(pin.title, 'Event one');
  assert.equal(pin.values.Sun, 359);
  assert.equal(pin.houseSystem, 'equal');
  assert.equal(pin.calculatedFor, '2026-09-12T12:00:15.000Z');
  assert.ok(Object.isFrozen(pin)); assert.ok(Object.isFrozen(pin.values));
});

test('comparison uses shortest separation across zero and handles antipodes and identical angles', () => {
  const pin = captureComparison(EVENT, CHART);
  const next = captureComparison(EVENT, { ...CHART, positions: [{ body: 'Sun', longitude: 1 }, { body: 'Moon', longitude: 180 }] });
  const result = compareCharts(pin, next);
  assert.equal(result.rows.length, 12);
  assert.equal(result.rows.find((row) => row.body === 'Sun').separation, 2);
  assert.equal(result.rows.find((row) => row.body === 'Moon').separation, 180);
  assert.equal(result.rows.find((row) => row.body === 'Ascendant').separation, 0);
  assert.equal(compareCharts(next, pin).rows[0].separation, 2);
});

test('missing, non-numeric and out-of-range longitudes remain unavailable, not zero', () => {
  for (const value of [undefined, null, NaN, Infinity, -1, 361, '10']) {
    const pin = captureComparison(EVENT, { ...CHART, positions: [{ body: 'Sun', longitude: value }] });
    const row = compareCharts(pin, captureComparison(EVENT, CHART)).rows[0];
    assert.equal(row.pinned, null); assert.equal(row.separation, null);
  }
  assert.equal(captureComparison(EVENT, { ...CHART, positions: [{ body: 'Sun', longitude: 360 }] }).values.Sun, 0);
});

test('different engine versions, frames and zodiacs cannot yield a numeric comparison', () => {
  const pin = captureComparison(EVENT, CHART);
  for (const field of ['engine', 'version', 'frame', 'zodiac']) {
    const result = compareCharts(pin, { ...pin, [field]: 'other' });
    assert.deepEqual(result.rows, []); assert.match(result.warning, /unavailable/);
  }
});

test('different house systems retain longitude comparison with an explicit warning', () => {
  const pin = captureComparison(EVENT, CHART);
  const result = compareCharts(pin, { ...pin, houseSystem: 'whole-sign' });
  assert.equal(result.rows.length, 12);
  assert.match(result.warning, /not house assignments/);
});

test('invalid chart time or missing conventions cannot be pinned', () => {
  for (const calculatedFor of [null, '', 'bad-date']) assert.throws(() => captureComparison(EVENT, { ...CHART, calculatedFor }), /chart time/);
  assert.throws(() => captureComparison(EVENT, { ...CHART, engine: {} }), /engine/);
});
