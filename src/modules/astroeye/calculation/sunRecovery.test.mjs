import assert from 'node:assert/strict';
import test from 'node:test';
import { createStablePlanetaryHourCalculator } from './stablePlanetaryHours.js';
import { renderPlanetaryHour } from '../planetaryHourPresentation.js';

// INTERNAL CONSISTENCY ONLY. July 27/28 USNO retrieval failed; these are not
// independently verified sunrise times and must not enter the external fixture pack.
const observer = { latitude: 70, longitude: 0, timeZone: 'UTC' };
const iso = (ms) => new Date(ms).toISOString();
const input = (utcInstant) => ({ ...observer, utcInstant });

test('internal recovery: first computed sunrise restores hour 1 and all resumed edges stay half-open', () => {
  const calculate = createStablePlanetaryHourCalculator();
  const at = (ms) => calculate(input(iso(ms)));
  let hour = calculate(input('2024-07-27T00:21:00Z'));
  assert.equal(hour.status, 'exact');
  assert.equal(hour.hourNumber, 1);
  const rise = Date.parse(hour.start);
  const before = at(rise - 1);
  assert.equal(before.status, 'unavailable');
  for (const key of ['start', 'end', 'ruler', 'dayRuler', 'hourNumber']) assert.equal(Object.hasOwn(before, key), false);
  assert.deepEqual(at(rise), hour);
  assert.deepEqual(at(rise + 1), hour);
  assert.equal(hour.dayRuler, 'Saturn');
  assert.equal(hour.ruler, 'Saturn');
  assert.deepEqual(createStablePlanetaryHourCalculator()(input(iso(rise))), hour);
  for (let n = 1; n <= 24; n++) {
    assert.equal(hour.hourNumber, n);
    assert.equal(hour.dayRuler, 'Saturn');
    assert.equal(hour.period, n <= 12 ? 'day' : 'night');
    const edge = Date.parse(hour.end), exact = at(edge);
    assert.deepEqual(at(edge - 1), hour);
    assert.equal(exact.hourNumber, n === 24 ? 1 : n + 1);
    assert.equal(exact.start, hour.end);
    assert.equal(exact.dayRuler, n === 24 ? 'Sun' : 'Saturn');
    assert.deepEqual(at(edge + 1), exact);
    assert.deepEqual(createStablePlanetaryHourCalculator()(input(iso(edge))), exact);
    hour = exact;
  }
});

test('internal recovery: unavailable roots cannot poison later results or depend on navigation order', () => {
  const warm = createStablePlanetaryHourCalculator(), evicted = createStablePlanetaryHourCalculator({ cacheLimit: 1 });
  const cases = [
    ['2024-05-17T12:00:00Z', 'unavailable'],
    ['2024-06-21T12:00:00Z', 'unavailable'],
    ['2024-07-26T23:58:00Z', 'unavailable'],
    ['2024-07-27T00:21:00Z', 'exact'],
    ['2024-07-27T23:59:59.999Z', 'exact'],
    ['2024-07-28T00:00:00.000Z', 'exact'],
    ['2024-07-28T12:00:00Z', 'exact'],
  ];
  for (const [utcInstant, status] of [...cases, ...cases.toReversed(), ...cases]) {
    const value = input(utcInstant), untouched = JSON.stringify(value);
    const expected = createStablePlanetaryHourCalculator()(value), frozen = JSON.stringify(expected);
    assert.equal(expected.status, status);
    assert.deepEqual(warm(value), expected);
    assert.deepEqual(evicted(value), expected);
    assert.equal(JSON.stringify(value), untouched);
    assert.equal(JSON.stringify(expected), frozen);
    assert.ok(Object.isFrozen(expected));
  }
});

test('internal recovery: presentation clears unavailable and boundary notices in both directions', () => {
  const calculate = createStablePlanetaryHourCalculator();
  const first = calculate(input('2024-07-27T00:21:00Z')), rise = Date.parse(first.start);
  const label = { textContent: '' }, notice = { textContent: '', dataset: {} };
  const states = [
    [rise - 1, 'Unavailable', false],
    [rise, 'Boundary uncertain', true],
    [rise + 1001, 'Saturn · day 1', false],
    [rise, 'Boundary uncertain', true],
    [rise - 1, 'Unavailable', false],
  ];
  for (const [instant, expectedLabel, uncertain] of states) {
    const chart = { calculatedFor: iso(instant), planetaryHour: calculate(input(iso(instant))) };
    const snapshot = JSON.stringify(chart);
    renderPlanetaryHour(label, notice, chart);
    assert.equal(label.textContent, expectedLabel);
    assert.equal(notice.dataset.uncertain, String(uncertain));
    if (expectedLabel === 'Unavailable') assert.match(notice.textContent, /No complete sunrise/);
    else if (uncertain) assert.match(notice.textContent, /Boundary uncertain/);
    else assert.match(notice.textContent, /estimates/);
    assert.equal(JSON.stringify(chart), snapshot);
  }
});
