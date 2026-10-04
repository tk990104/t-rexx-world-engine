import assert from 'node:assert/strict';
import test from 'node:test';
import { readSouthernTransitions, compareSouthernTransitions } from '../../../../scripts/astroeye-southern-transitions.mjs';
import { parseSunReference } from '../../../../scripts/astroeye-sun-references.mjs';
import { createStablePlanetaryHourCalculator } from './stablePlanetaryHours.js';

const calculate = createStablePlanetaryHourCalculator();
const at = ms => calculate({ utcInstant: new Date(ms).toISOString(), latitude: -70, longitude: 0, timeZone: 'UTC' });
const noHour = hour => {
  assert.equal(hour.status, 'unavailable');
  for (const key of ['ruler', 'dayRuler', 'start', 'end', 'hourNumber']) assert.equal(Object.hasOwn(hour, key), false);
};

test('southern report preserves ten matching days and two unresolved days, not blanket acceptance', () => {
  const pack = readSouthernTransitions(), before = JSON.stringify(pack), results = compareSouthernTransitions(pack);
  assert.equal(results.filter(row => row.passed === true).length, 10);
  assert.deepEqual(results.filter(row => row.passed !== true).map(row => row.id), ['south-2024-01-24', 'south-2024-01-25']);
  assert.equal(results[0].outcome, 'discrepancy'); assert.equal(results[0].boundaries.set.expected, null);
  assert.equal(results[0].boundaries.set.passed, false);
  assert.equal(results[1].outcome, 'unsupported-shape'); assert.equal(results[1].passed, null);
  assert.equal(results[1].sourceInstants.length, 3);
  // Near-midnight proximity is context, not permission to relabel either source day.
  const delta = Date.parse(results[1].sourceInstants[0]) - Date.parse(results[0].boundaries.set.actual);
  assert.ok(delta > 0 && delta < 120000);
  assert.equal(JSON.stringify(pack), before);
});

test('three complete southern cycles pass 72 independently anchored hour midpoints', () => {
  const pack = readSouthernTransitions(), parse = i => parseSunReference(pack.cases[i], { allowPartial: true });
  let compared = 0;
  for (const [a, b, rulers] of [
    [3, 4, ['Mercury', 'Moon', 'Saturn', 'Jupiter', 'Mars', 'Sun', 'Venus']],
    [7, 8, ['Venus', 'Mercury', 'Moon', 'Saturn', 'Jupiter', 'Mars', 'Sun']],
    [9, 10, ['Saturn', 'Jupiter', 'Mars', 'Sun', 'Venus', 'Mercury', 'Moon']],
  ]) {
    const first = parse(a), next = parse(b), edges = [first.rise, first.set, next.rise].map(Date.parse);
    for (let i = 0; i < 24; i++) {
      const night = i >= 12, start = edges[night ? 1 : 0], end = edges[night ? 2 : 1];
      const length = (end - start) / 12, edge = start + i % 12 * length, instant = edge + length / 2;
      assert.ok(length / 2 > pack.toleranceSeconds * 1000, 'source precision must resolve each tested midpoint');
      const hour = at(instant); compared++;
      assert.equal(hour.status, 'exact'); assert.equal(hour.hourNumber, i + 1);
      assert.equal(hour.period, night ? 'night' : 'day');
      assert.equal(hour.dayRuler, rulers[0]); assert.equal(hour.ruler, rulers[i % 7]);
      assert.ok(Date.parse(hour.start) <= instant && instant < Date.parse(hour.end));
      assert.ok(Math.abs(Date.parse(hour.start) - edge) <= pack.toleranceSeconds * 1000);
      assert.ok(Math.abs(Date.parse(hour.end) - edge - length) <= pack.toleranceSeconds * 1000);
    }
  }
  assert.equal(compared, 72);
});

test('southern winter and summer availability changes are bracketed without inventing missing hours', () => {
  const pack = readSouthernTransitions(), parse = i => parseSunReference(pack.cases[i], { allowPartial: true });
  const margin = pack.boundaryProbeSeconds * 1000;
  for (const index of [4, 10]) {
    const rise = Date.parse(parse(index).rise);
    assert.equal(at(rise - margin).hourNumber, 24);
    noHour(at(rise + margin));
  }
  for (const index of [5, 6, 11]) noHour(at(Date.parse(parse(index).noon)));
  const rise = Date.parse(parse(7).rise);
  noHour(at(rise - margin));
  assert.equal(at(rise + margin).hourNumber, 1); assert.equal(at(rise + margin).dayRuler, 'Venus');
});

test('ordinary parser still refuses the genuine two-set day; no reference entry is silently dropped', () => {
  const row = readSouthernTransitions().cases[1];
  assert.throws(() => parseSunReference(row, { allowPartial: true }), /solar reference/);
  assert.deepEqual(row.response.properties.data.sundata.filter(entry => entry.phen === 'Set').map(entry => entry.time), ['00:00', '23:33']);
});

test('southern coverage and multi-boundary metadata fail closed when damaged', () => {
  for (const mutate of [
    p => { p.toleranceSeconds = 600; }, p => { p.boundaryProbeSeconds = 0; },
    p => { p.source.retrievedOn = '2026-10-03'; }, p => { p.cases.pop(); },
    p => { p.cases.reverse(); }, p => { p.cases[1].url = p.cases[0].url; },
    p => { p.cases[1].response.geometry.coordinates[1] = 70; },
    p => { p.cases[1].response.properties.data.sundata.splice(1, 1); },
    p => { p.cases[1].response.properties.data.sundata[1].time = 'bad'; },
    p => { p.cases[5].response.properties.data.sundata.push({ phen: 'Rise', time: '12:00' }); },
  ]) {
    const pack = readSouthernTransitions(); mutate(pack);
    assert.throws(() => compareSouthernTransitions(pack), /reference/);
  }
});

test('shifted valid source times create another failed comparison without hiding existing gaps', () => {
  const pack = readSouthernTransitions();
  pack.cases[3].response.properties.data.sundata.find(row => row.phen === 'Rise').time = '11:06';
  const results = compareSouthernTransitions(pack);
  assert.equal(results.filter(row => row.passed === true).length, 9);
  assert.equal(results[3].passed, false);
});
