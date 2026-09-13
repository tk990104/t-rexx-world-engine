import assert from 'node:assert/strict';
import test from 'node:test';
import { createStablePlanetaryHourCalculator, partitionPlanetaryInterval } from './stablePlanetaryHours.js';
import { calculatePlanetaryHour } from './planetaryHours.js';
import { calculateAstroEyeChart } from './chart.js';
import { ASTROEYE_REGRESSION_CASES, eventFromRegressionCase, chartRegressionFingerprint } from './regressionCases.js';

const iso = (ms) => new Date(ms).toISOString();
const fixtures = [
  { latitude: 40.7128, longitude: -74.006, timeZone: 'America/New_York', seed: '2024-03-10T11:15:30Z', ruler: 'Sun', nextRuler: 'Moon' },
  { latitude: -33.8688, longitude: 151.2093, timeZone: 'Australia/Sydney', seed: '2024-06-20T21:00:30Z', ruler: 'Venus', nextRuler: 'Saturn' },
];

test('integer partitions cover the interval exactly and assign each edge to the following segment', () => {
  const start = Date.parse('2024-01-01T00:00:00Z'), end = start + 1301;
  for (let i = 0; i < 12; i++) {
    const edge = start + Math.floor((end - start) * i / 12);
    const part = partitionPlanetaryInterval(start, end, edge);
    assert.equal(part.index, i); assert.equal(part.start, edge); assert.ok(Object.isFrozen(part));
    if (i) assert.equal(partitionPlanetaryInterval(start, end, edge - 1).index, i - 1);
    assert.equal(partitionPlanetaryInterval(start, end, edge + 1).index, i);
  }
  for (let instant = start; instant < end; instant++) {
    const part = partitionPlanetaryInterval(start, end, instant);
    assert.ok(part.start <= instant && instant < part.end);
  }
  for (const args of [[start, end, end], [start, end, start - 1], [0, 11, 1], [0, 20, null], [0, 20, 1.5], [0, Infinity, 1]]) {
    assert.throws(() => partitionPlanetaryInterval(...args), /interval/);
  }
});

for (const fixture of fixtures) {
  test(`all 24 real computed edges remain stable and half-open: ${fixture.timeZone}`, () => {
    const calculate = createStablePlanetaryHourCalculator();
    const at = (ms) => calculate({ ...fixture, utcInstant: iso(ms) });
    let hour = calculate({ ...fixture, utcInstant: fixture.seed });
    assert.equal(hour.hourNumber, 1);
    const rise = Date.parse(hour.start);
    assert.equal(at(rise - 1).hourNumber, 24);
    assert.equal(at(rise).hourNumber, 1);
    for (let n = 1; n <= 24; n++) {
      assert.equal(hour.hourNumber, n); assert.equal(hour.dayRuler, fixture.ruler);
      const edge = Date.parse(hour.end), before = at(edge - 1), exact = at(edge), after = at(edge + 1);
      assert.equal(before.hourNumber, n); assert.equal(before.end, hour.end);
      assert.equal(exact.hourNumber, n === 24 ? 1 : n + 1);
      assert.equal(exact.start, hour.end);
      assert.deepEqual(exact, after);
      assert.ok(Date.parse(exact.start) <= edge && edge < Date.parse(exact.end));
      assert.equal(exact.dayRuler, n === 24 ? fixture.nextRuler : fixture.ruler);
      assert.deepEqual(at(edge), exact, 'approaching again from either side is byte-stable');
      assert.deepEqual(createStablePlanetaryHourCalculator()({ ...fixture, utcInstant: iso(edge) }), exact,
        'a fresh root search yields the identical boundary without a warm cache');
      hour = exact;
    }
  });
}

test('cold, warm and constantly evicted caches agree across UTC midnight, folds and unusual offsets', () => {
  const warm = createStablePlanetaryHourCalculator(), evicting = createStablePlanetaryHourCalculator({ cacheLimit: 1 });
  const cases = [
    { ...fixtures[0], utcInstant: '2024-03-11T00:00:00.000Z' },
    { ...fixtures[0], utcInstant: '2024-03-10T23:59:59.999Z' },
    { ...fixtures[0], utcInstant: '2024-11-03T05:30:00Z' },
    { ...fixtures[0], utcInstant: '2024-11-03T06:30:00Z' },
    { latitude: 27.7172, longitude: 85.324, timeZone: 'Asia/Kathmandu', utcInstant: '2024-06-21T00:00:00Z' },
    { latitude: 1.8721, longitude: -157.4278, timeZone: 'Pacific/Kiritimati', utcInstant: '2024-06-21T12:00:00Z' },
  ];
  for (const input of [...cases, ...cases.toReversed()]) {
    const result = warm(input);
    assert.equal(result.status, 'exact');
    assert.deepEqual(evicting(input), result);
    assert.deepEqual(createStablePlanetaryHourCalculator()(input), result);
    assert.ok(Date.parse(result.start) <= Date.parse(input.utcInstant) && Date.parse(input.utcInstant) < Date.parse(result.end));
  }
});

test('polar absence stays unavailable; invalid observer, zone, cache and model inputs fail explicitly', () => {
  for (const latitude of [-80, 80]) {
    assert.equal(calculatePlanetaryHour({ utcInstant: '2024-06-21T12:00:00Z', latitude, longitude: 0, timeZone: 'UTC' }).status, 'unavailable');
  }
  for (const change of [{ latitude: null }, { longitude: Infinity }, { timeZone: '' }, { timeZone: 'Bad/Zone' },
    { utcInstant: 'invalid' }, { calculationVersion: 4 }]) {
    assert.throws(() => calculatePlanetaryHour({ ...fixtures[0], utcInstant: fixtures[0].seed, ...change }));
  }
  assert.throws(() => createStablePlanetaryHourCalculator({ cacheLimit: 0 }), /cache/);
});

test('model 3 corrects the reproduced edge while both old models retain their exact hour output', () => {
  const input = { ...fixtures[0], utcInstant: '2024-03-10T16:00:00Z' };
  const one = calculatePlanetaryHour({ ...input, calculationVersion: 1 });
  assert.deepEqual(calculatePlanetaryHour({ ...input, calculationVersion: 2 }), one);
  const modern = calculatePlanetaryHour(input);
  assert.equal(modern.boundaryMethod, 'utc-day-anchored-half-open-ms');
  const next = calculatePlanetaryHour({ ...input, utcInstant: modern.end });
  assert.equal(next.hourNumber, modern.hourNumber + 1);
  assert.equal(next.start, modern.end);
});

test('all twenty model-3 regression charts preserve the established sampled fingerprint', () => {
  for (const sample of ASTROEYE_REGRESSION_CASES) {
    const event = eventFromRegressionCase(sample);
    const old = calculateAstroEyeChart(event, { calculationVersion: 2 });
    const modern = calculateAstroEyeChart(event);
    assert.equal(modern.calculationVersion, 3);
    assert.deepEqual(chartRegressionFingerprint(modern), chartRegressionFingerprint(old), sample.id);
    assert.deepEqual(modern.houses, old.houses, 'model 3 does not change angles or cusps');
  }
});
