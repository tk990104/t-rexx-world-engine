import assert from 'node:assert/strict';
import test from 'node:test';
import { readSunTransitions, compareSunTransitions } from '../../../../scripts/astroeye-sun-transitions.mjs';
import { parseSunReference } from '../../../../scripts/astroeye-sun-references.mjs';
import { calculatePlanetaryHour } from './planetaryHours.js';
import { createStablePlanetaryHourCalculator } from './stablePlanetaryHours.js';

const at = (utcInstant) => calculatePlanetaryHour({ utcInstant, latitude: 70, longitude: 0, timeZone: 'UTC' });
const parse = (row) => parseSunReference(row, { allowPartial: true });
const noHour = (hour) => {
  assert.equal(hour.status, 'unavailable');
  assert.match(hour.reason, /No complete sunrise–sunset–sunrise interval/);
  for (const field of ['ruler', 'dayRuler', 'start', 'end', 'hourNumber']) assert.equal(Object.hasOwn(hour, field), false);
};

test('four independent transition days match both present and absent solar boundaries', () => {
  const pack = readSunTransitions(), before = JSON.stringify(pack), results = compareSunTransitions(pack);
  assert.deepEqual(results.map((r) => r.status), ['rise-set', 'rise-only', 'polar-day', 'set-only']);
  assert.ok(results.every((r) => r.passed), JSON.stringify(results));
  assert.equal(results.flatMap((r) => Object.values(r.boundaries)).filter((r) => r.expected === null).length, 4);
  assert.equal(JSON.stringify(pack), before);
});

test('the last complete cycle has 24 source-based midpoints including a twelve-minute night', () => {
  const pack = readSunTransitions(), [first, last] = pack.cases.map(parse);
  const edges = [first.rise, first.set, last.rise].map(Date.parse);
  assert.equal(edges[2] - edges[1], 12 * 60000);
  const rulers = 'Mercury Moon Saturn Jupiter Mars Sun Venus'.split(' ');
  for (let i = 0; i < 24; i++) {
    const night = i >= 12, start = edges[night ? 1 : 0], end = edges[night ? 2 : 1], length = (end - start) / 12;
    const instant = start + (i % 12 + 0.5) * length, hour = at(new Date(instant).toISOString());
    assert.equal(hour.status, 'exact');
    assert.equal(hour.hourNumber, i + 1);
    assert.equal(hour.period, night ? 'night' : 'day');
    assert.equal(hour.dayRuler, 'Mercury');
    assert.equal(hour.ruler, rulers[i % 7]);
    assert.ok(Date.parse(hour.start) <= instant && instant < Date.parse(hour.end));
    assert.ok(Math.abs(Date.parse(hour.start) - (start + i % 12 * length)) <= pack.toleranceSeconds * 1000);
    assert.ok(Math.abs(Date.parse(hour.end) - (start + (i % 12 + 1) * length)) <= pack.toleranceSeconds * 1000);
  }
});

test('last sunrise switches from a complete cycle to unavailable without assigning a new ruler', () => {
  const pack = readSunTransitions(), reference = parse(pack.cases[1]), boundary = Date.parse(reference.rise);
  const before = at(new Date(boundary - pack.boundaryProbeSeconds * 1000).toISOString());
  assert.equal(before.status, 'exact');
  assert.equal(before.period, 'night');
  assert.equal(before.dayRuler, 'Mercury');
  noHour(at(new Date(boundary + pack.boundaryProbeSeconds * 1000).toISOString()));
  noHour(at('2024-05-17T12:00:00Z'));
  // Computed millisecond boundary consistency is separate from minute-rounded
  // external timing agreement. A new cache must make the same availability choice.
  const lastHour = at('2024-05-16T00:01:50Z');
  assert.equal(lastHour.hourNumber, 24);
  const edge = Date.parse(lastHour.end);
  assert.equal(at(new Date(edge - 1).toISOString()).hourNumber, 24);
  for (const offset of [0, 1]) {
    const utcInstant = new Date(edge + offset).toISOString();
    noHour(at(utcInstant));
    noHour(createStablePlanetaryHourCalculator()({ utcInstant, latitude: 70, longitude: 0, timeZone: 'UTC' }));
  }
});

test('first sunset alone cannot restore a complete planetary day after continuous daylight', () => {
  const pack = readSunTransitions(), reference = parse(pack.cases[3]);
  for (const sign of [-1, 1]) noHour(at(new Date(Date.parse(reference.set) + sign * pack.boundaryProbeSeconds * 1000).toISOString()));
  noHour(at('2024-07-26T12:00:00Z'));
});

test('partial parsing is opt-in and transition contracts reject damaged reference shapes', () => {
  const pack = readSunTransitions();
  for (const row of [pack.cases[1], pack.cases[3]]) assert.throws(() => parseSunReference(row), /USNO solar reference/);
  for (const mutate of [
    (p) => { p.cases[0].response.properties.data.sundata = p.cases[0].response.properties.data.sundata.filter((r) => r.phen !== 'Rise'); },
    (p) => { p.cases[1].expectedStatus = 'rise-set'; },
    (p) => { p.cases[1].response.properties.data.sundata.push({ phen: 'Set', time: '23:59' }); },
    (p) => { p.cases[1].response.properties.data.sundata[1].time = null; },
    (p) => { p.cases[1].response.properties.data.sundata.push({ phen: 'Rise', time: '00:03' }); },
    (p) => { p.cases[3].response.geometry.coordinates[1] = -70; },
    (p) => { p.toleranceSeconds = 600; },
    (p) => { p.boundaryProbeSeconds = 0; },
    (p) => { p.cases.pop(); },
    (p) => { p.cases[1].id = p.cases[0].id; },
  ]) {
    const damaged = structuredClone(pack); mutate(damaged);
    assert.throws(() => compareSunTransitions(damaged), /solar (transition )?reference/);
  }
});

test('shifted transition times fail without widening the preselected screen', () => {
  const pack = readSunTransitions();
  pack.cases[3].response.properties.data.sundata.find((r) => r.phen === 'Set').time = '23:44';
  assert.equal(compareSunTransitions(pack)[3].passed, false);
});
