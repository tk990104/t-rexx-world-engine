import assert from 'node:assert/strict';
import test from 'node:test';
import { readPolarNightReferences, comparePolarNightReferences } from '../../../../scripts/astroeye-polar-night.mjs';
import { parseSunReference } from '../../../../scripts/astroeye-sun-references.mjs';
import { createStablePlanetaryHourCalculator } from './stablePlanetaryHours.js';

const input = ms => ({ utcInstant: new Date(ms).toISOString(), latitude: 70, longitude: 0, timeZone: 'UTC' });
const calculate = createStablePlanetaryHourCalculator();
const at = ms => calculate(input(ms));
const noHour = hour => {
  assert.equal(hour.status, 'unavailable');
  for (const key of ['ruler', 'dayRuler', 'start', 'end', 'hourNumber']) assert.equal(Object.hasOwn(hour, key), false);
};

test('six independent polar-night days match eight present and four absent boundaries', () => {
  const pack = readPolarNightReferences(), before = JSON.stringify(pack), results = comparePolarNightReferences(pack);
  assert.ok(results.every(result => result.passed), JSON.stringify(results));
  assert.equal(results.flatMap(result => Object.values(result.boundaries)).filter(row => row.expected === null).length, 4);
  assert.equal(JSON.stringify(pack), before);
});

test('source-derived midpoint checks distinguish decisive hours from unresolved short-day hours', () => {
  const pack = readPolarNightReferences(), rows = pack.cases.map(row => parseSunReference(row));
  let decisive = 0, unresolved = 0;
  for (const [first, next, rulers] of [
    [rows[0], rows[1], ['Saturn', 'Jupiter', 'Mars', 'Sun', 'Venus', 'Mercury', 'Moon']],
    [rows[4], rows[5], ['Jupiter', 'Mars', 'Sun', 'Venus', 'Mercury', 'Moon', 'Saturn']],
  ]) {
    const edges = [first.rise, first.set, next.rise].map(Date.parse);
    for (let i = 0; i < 24; i++) {
      const night = i >= 12, start = edges[night ? 1 : 0], end = edges[night ? 2 : 1];
      const length = (end - start) / 12, edge = start + i % 12 * length;
      // Do not certify a specific hour when source/tolerance uncertainty crosses its edges.
      if (length / 2 <= pack.toleranceSeconds * 1000) { unresolved++; continue; }
      const instant = edge + length / 2, hour = at(instant); decisive++;
      assert.equal(hour.status, 'exact'); assert.equal(hour.hourNumber, i + 1);
      assert.equal(hour.period, night ? 'night' : 'day');
      assert.equal(hour.dayRuler, rulers[0]); assert.equal(hour.ruler, rulers[i % 7]);
      assert.ok(Date.parse(hour.start) <= instant && instant < Date.parse(hour.end));
      assert.ok(Math.abs(Date.parse(hour.start) - edge) <= pack.toleranceSeconds * 1000);
      assert.ok(Math.abs(Date.parse(hour.end) - edge - length) <= pack.toleranceSeconds * 1000);
    }
  }
  assert.equal(decisive, 36); assert.equal(unresolved, 12);
  assert.equal(Date.parse(rows[4].set) - Date.parse(rows[4].rise), 10 * 60000);
});

test('source probes preserve missing-cycle policy on last sunrise and recover only with a complete cycle', () => {
  const pack = readPolarNightReferences(), rows = pack.cases.map(row => parseSunReference(row)), margin = pack.boundaryProbeSeconds * 1000;
  const last = Date.parse(rows[1].rise), first = Date.parse(rows[4].rise), sunset = Date.parse(rows[4].set);
  assert.equal(at(last - margin).hourNumber, 24);
  noHour(at(last + margin)); // A same-day rise/set pair alone lacks the next sunrise.
  for (const row of [rows[2], rows[3]]) noHour(at(Date.parse(row.noon)));
  noHour(at(first - margin));
  const recovered = at(first + margin);
  assert.equal(recovered.status, 'exact'); assert.equal(recovered.period, 'day'); assert.equal(recovered.dayRuler, 'Jupiter');
  // Daylight lasts only ten rounded minutes: do not assert its sub-minute hour number.
  assert.equal(at(sunset - margin).period, 'day');
  assert.equal(at(sunset + margin).hourNumber, 13);
  const next = Date.parse(rows[5].rise);
  assert.equal(at(next - margin).hourNumber, 24);
  assert.equal(at(next + margin).hourNumber, 1); assert.equal(at(next + margin).dayRuler, 'Venus');
});

test('computed winter transition edges remain half-open with fresh caches, separate from source accuracy', () => {
  const rows = readPolarNightReferences().cases.map(row => parseSunReference(row));
  const last = at(Date.parse(rows[1].rise) - 240000), end = Date.parse(last.end);
  assert.equal(at(end - 1).hourNumber, 24);
  noHour(at(end)); noHour(at(end + 1));
  const firstDay = at(Date.parse(rows[4].rise) + 240000);
  // Walk back to hour 1 using the stable daylight partition, not an external timestamp.
  let first = firstDay;
  for (let step = 0; step < 11 && first.hourNumber > 1; step++) first = at(Date.parse(first.start) - 1);
  assert.equal(first.hourNumber, 1);
  const begin = Date.parse(first.start);
  noHour(at(begin - 1));
  assert.equal(at(begin).hourNumber, 1); assert.deepEqual(at(begin + 1), at(begin));
  let hour = at(begin);
  for (let n = 1; n <= 24; n++) {
    assert.equal(hour.hourNumber, n);
    const edge = Date.parse(hour.end), next = at(edge);
    assert.deepEqual(at(edge - 1), hour);
    assert.equal(next.hourNumber, n === 24 ? 1 : n + 1);
    assert.equal(next.start, hour.end); assert.deepEqual(at(edge + 1), next);
    assert.deepEqual(createStablePlanetaryHourCalculator()(input(edge)), next);
    hour = next;
  }
});

test('polar-night contract rejects missing, contradictory and wrong-location evidence', () => {
  for (const mutate of [
    p => { p.toleranceSeconds = 600; }, p => { p.boundaryProbeSeconds = 0; },
    p => { p.cases.pop(); }, p => { p.cases.reverse(); },
    p => { p.cases[2].response.properties.data.sundata.push({ phen: 'Rise', time: '12:00' }); },
    p => { p.cases[2].response.properties.data.sundata.shift(); },
    p => { p.cases[2].response.geometry.coordinates[1] = -70; },
    p => { p.cases[4].response.properties.data.sundata.splice(1, 1); },
    p => { p.cases[0].url = p.cases[1].url; },
  ]) {
    const pack = readPolarNightReferences(); mutate(pack);
    assert.throws(() => comparePolarNightReferences(pack), /reference/);
  }
});

test('shifted winter sunrise fails without widening the existing tolerance', () => {
  const pack = readPolarNightReferences();
  pack.cases[4].response.properties.data.sundata.find(row => row.phen === 'Rise').time = '11:55';
  assert.equal(comparePolarNightReferences(pack)[4].passed, false);
});
