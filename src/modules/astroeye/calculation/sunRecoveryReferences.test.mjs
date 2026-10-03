import assert from 'node:assert/strict';
import test from 'node:test';
import { readSunRecovery, compareSunRecovery } from '../../../../scripts/astroeye-sun-recovery.mjs';
import { parseSunReference } from '../../../../scripts/astroeye-sun-references.mjs';
import { calculatePlanetaryHour } from './planetaryHours.js';

const at = ms => calculatePlanetaryHour({ utcInstant: new Date(ms).toISOString(), latitude: 70, longitude: 0, timeZone: 'UTC' });

test('independent recovery references agree on all four sunrise/set boundaries', () => {
  const pack = readSunRecovery(), before = JSON.stringify(pack), results = compareSunRecovery(pack);
  assert.equal(results.length, 2);
  assert.ok(results.every(result => result.passed), JSON.stringify(results));
  assert.equal(JSON.stringify(pack), before);
});

test('all 24 resumed hours agree at independently sourced midpoints', () => {
  const pack = readSunRecovery(), [first, second] = pack.cases.map(row => parseSunReference(row));
  const edges = [first.rise, first.set, second.rise].map(Date.parse);
  assert.equal(edges[2] - edges[1], 76 * 60000);
  const rulers = ['Saturn', 'Jupiter', 'Mars', 'Sun', 'Venus', 'Mercury', 'Moon'];
  for (let i = 0; i < 24; i++) {
    const night = i >= 12, start = edges[night ? 1 : 0], end = edges[night ? 2 : 1];
    const length = (end - start) / 12, expectedStart = start + i % 12 * length;
    const instant = expectedStart + length / 2, hour = at(instant);
    // Reference rounding/tolerance must not straddle the selected midpoint.
    assert.ok(length / 2 > pack.toleranceSeconds * 1000);
    assert.equal(hour.status, 'exact'); assert.equal(hour.hourNumber, i + 1);
    assert.equal(hour.period, night ? 'night' : 'day');
    assert.equal(hour.dayRuler, 'Saturn'); assert.equal(hour.ruler, rulers[i % 7]);
    assert.ok(Date.parse(hour.start) <= instant && instant < Date.parse(hour.end));
    assert.ok(Math.abs(Date.parse(hour.start) - expectedStart) <= pack.toleranceSeconds * 1000);
    assert.ok(Math.abs(Date.parse(hour.end) - (expectedStart + length)) <= pack.toleranceSeconds * 1000);
  }
});

test('source-based probes bracket recovery, sunset and the next planetary day', () => {
  const pack = readSunRecovery(), [first, second] = pack.cases.map(row => parseSunReference(row));
  const margin = pack.boundaryProbeSeconds * 1000;
  const unavailable = at(Date.parse(first.rise) - margin);
  assert.equal(unavailable.status, 'unavailable');
  for (const key of ['ruler', 'dayRuler', 'start', 'end', 'hourNumber']) assert.equal(Object.hasOwn(unavailable, key), false);
  for (const [instant, number, day] of [
    [Date.parse(first.rise) + margin, 1, 'Saturn'],
    [Date.parse(first.set) - margin, 12, 'Saturn'],
    [Date.parse(first.set) + margin, 13, 'Saturn'],
    [Date.parse(second.rise) - margin, 24, 'Saturn'],
    [Date.parse(second.rise) + margin, 1, 'Sun'],
  ]) {
    const hour = at(instant);
    assert.equal(hour.status, 'exact'); assert.equal(hour.hourNumber, number); assert.equal(hour.dayRuler, day);
  }
});

test('recovery metadata and incomplete, duplicate or wrong-location references fail closed', () => {
  for (const change of [
    p => { p.source.retrievedOn = '2026-09-13'; },
    p => { p.toleranceSeconds = 600; },
    p => { p.boundaryProbeSeconds = 0; },
    p => { p.cases.pop(); }, p => { p.cases[1] = p.cases[0]; },
    p => { p.cases[0].response.geometry.coordinates[1] = -70; },
    p => { p.cases[0].response.properties.data.sundata.splice(1, 1); },
    p => { p.cases[0].response.properties.data.sundata.push({ phen: 'Rise', time: '00:20' }); },
    p => { p.cases[0].url = p.cases[1].url; },
  ]) {
    const pack = readSunRecovery(); change(pack);
    assert.throws(() => compareSunRecovery(pack), /solar (recovery )?reference/);
  }
});

test('shifted solar references fail without changing the preselected tolerance', () => {
  const pack = readSunRecovery();
  pack.cases[0].response.properties.data.sundata.find(row => row.phen === 'Rise').time = '00:30';
  assert.equal(compareSunRecovery(pack)[0].passed, false);
});
