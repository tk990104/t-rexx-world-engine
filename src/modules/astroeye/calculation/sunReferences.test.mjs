import assert from 'node:assert/strict';
import test from 'node:test';
import { readSunReferences, parseSunReference, compareSunReferences } from '../../../../scripts/astroeye-sun-references.mjs';
import { calculatePlanetaryHour } from './planetaryHours.js';

const sequences = [
  ['new-york-dst-day', 'new-york-next-day', 'Sun', 'Moon',
    'Sun Venus Mercury Moon Saturn Jupiter Mars Sun Venus Mercury Moon Saturn Jupiter Mars Sun Venus Mercury Moon Saturn Jupiter Mars Sun Venus Mercury'],
  ['sydney-winter-day', 'sydney-next-day', 'Venus', 'Saturn',
    'Venus Mercury Moon Saturn Jupiter Mars Sun Venus Mercury Moon Saturn Jupiter Mars Sun Venus Mercury Moon Saturn Jupiter Mars Sun Venus Mercury Moon'],
  ['north-65-solstice-day', 'north-65-next-day', 'Venus', 'Saturn',
    'Venus Mercury Moon Saturn Jupiter Mars Sun Venus Mercury Moon Saturn Jupiter Mars Sun Venus Mercury Moon Saturn Jupiter Mars Sun Venus Mercury Moon'],
];

test('USNO sunrise/set samples pass the preselected two-minute screen; polar night remains unavailable', () => {
  const pack = readSunReferences(), before = JSON.stringify(pack);
  const results = compareSunReferences(pack);
  assert.equal(results.filter((r) => r.status === 'rise-set').length, 6);
  assert.ok(results.every((r) => r.passed), JSON.stringify(results));
  assert.equal(results.at(-1).status, 'polar-night');
  assert.equal(JSON.stringify(pack), before);
});

test('fixed offsets and IANA zones preserve Sydney previous-UTC-date sunrise and New York DST-day data', () => {
  const { cases } = readSunReferences();
  assert.equal(parseSunReference(cases[0]).rise, '2024-03-10T11:15:00.000Z');
  assert.equal(parseSunReference(cases[2]).rise, '2024-06-20T21:00:00.000Z');
  assert.equal(parseSunReference(cases[2]).set, '2024-06-21T06:54:00.000Z');
});

for (const [id, nextId, dayRuler, nextRuler, order] of sequences) {
  test(`24 unequal-hour midpoints retain boundaries and traditional sequence: ${id}`, () => {
    const pack = readSunReferences(), row = pack.cases.find((r) => r.id === id);
    const ref = parseSunReference(row), next = parseSunReference(pack.cases.find((r) => r.id === nextId));
    const edges = [ref.rise, ref.set, next.rise].map(Date.parse);
    const rulers = order.split(' ');
    assert.equal(rulers.length, 24);
    for (let i = 0; i < 24; i++) {
      const night = i >= 12, start = edges[night ? 1 : 0], end = edges[night ? 2 : 1];
      const length = (end - start) / 12, segment = i % 12;
      const instant = start + (segment + 0.5) * length;
      const hour = calculatePlanetaryHour({ ...row, utcInstant: new Date(instant).toISOString() });
      assert.equal(hour.status, 'exact');
      assert.equal(hour.period, night ? 'night' : 'day');
      assert.equal(hour.hourNumber, i + 1);
      assert.equal(hour.dayRuler, dayRuler);
      assert.equal(hour.ruler, rulers[i]);
      assert.ok(Math.abs(Date.parse(hour.start) - (start + segment * length)) <= pack.toleranceSeconds * 1000);
      assert.ok(Math.abs(Date.parse(hour.end) - (start + (segment + 1) * length)) <= pack.toleranceSeconds * 1000);
      assert.ok(Date.parse(hour.start) <= instant && instant < Date.parse(hour.end));
    }
  });

  test(`sunset and next sunrise roll over outside the source rounding uncertainty: ${id}`, () => {
    const pack = readSunReferences(), row = pack.cases.find((r) => r.id === id);
    const ref = parseSunReference(row), next = parseSunReference(pack.cases.find((r) => r.id === nextId));
    for (const [boundary, beforeNumber, afterNumber, afterRuler] of [
      [ref.set, 12, 13, dayRuler], [next.rise, 24, 1, nextRuler],
    ]) {
      for (const sign of [-1, 1]) {
        const utcInstant = new Date(Date.parse(boundary) + sign * pack.boundaryProbeSeconds * 1000).toISOString();
        const hour = calculatePlanetaryHour({ ...row, utcInstant });
        assert.equal(hour.status, 'exact');
        assert.equal(hour.hourNumber, sign < 0 ? beforeNumber : afterNumber);
        assert.equal(hour.dayRuler, sign < 0 ? dayRuler : afterRuler);
      }
    }
  });
}

test('continuous twilight is not polar day: 65N retains a short night and preceding sunrise ruler', () => {
  const pack = readSunReferences(), row = pack.cases.find((r) => r.id === 'north-65-solstice-day');
  const ref = parseSunReference(row), next = parseSunReference(pack.cases.find((r) => r.id === 'north-65-next-day'));
  assert.equal(ref.status, 'rise-set');
  assert.equal(Date.parse(ref.set) - Date.parse(ref.rise), (22 * 60 + 2) * 60000);
  assert.equal(Date.parse(next.rise) - Date.parse(ref.set), 118 * 60000);
  const hour = calculatePlanetaryHour({ ...row, utcInstant: '2024-06-22T00:02:00Z' });
  assert.equal(hour.status, 'exact');
  assert.equal(hour.period, 'night');
  assert.equal(hour.dayRuler, 'Venus'); // Friday sunrise still owns Saturday pre-dawn.
  assert.ok(hour.hourLengthMinutes < 10);
  const missingRise = structuredClone(row);
  missingRise.response.properties.data.sundata = missingRise.response.properties.data.sundata.filter((r) => r.phen !== 'Rise');
  assert.throws(() => parseSunReference(missingRise), /USNO solar reference/);
});

test('shifted source times fail without widening the comparison tolerance', () => {
  const pack = readSunReferences();
  pack.cases[0].response.properties.data.sundata.find((entry) => entry.phen === 'Rise').time = '07:30';
  assert.equal(compareSunReferences(pack)[0].passed, false);
});

test('stale responses, missing boundaries and malformed metadata cannot masquerade as reference data', () => {
  for (const mutate of [
    (r) => { r.response.geometry.coordinates = [151.2093, -33.8688]; },
    (r) => { r.response.properties.data.day++; },
    (r) => { r.response.properties.data.day_of_week = 'Friday'; },
    (r) => { r.response.apiversion = 'future'; },
    (r) => { r.response.properties.data.tz = 0; },
    (r) => { r.response.properties.data.isdst = true; },
    (r) => { r.timeZone = undefined; },
    (r) => { r.timeZone = 'UTC'; },
    (r) => { r.url += '&tz=-4'; },
    (r) => { r.response.properties.data.sundata = []; },
    (r) => { r.response.properties.data.sundata.push(r.response.properties.data.sundata[1]); },
    (r) => { r.response.properties.data.sundata[1].time = null; },
    (r) => { r.response.properties.data.sundata[1].time = '25:00'; },
    (r) => { r.response.properties.data.sundata[1] = null; },
    (r) => { r.response.error = 'API unavailable'; },
  ]) {
    const row = readSunReferences().cases[0]; mutate(row);
    assert.throws(() => parseSunReference(row), /USNO solar reference/);
  }
  for (const mutate of [
    (p) => { p.toleranceSeconds = 600; }, (p) => { p.boundaryProbeSeconds = 0; },
    (p) => { p.cases.pop(); }, (p) => { p.cases[1].id = p.cases[0].id; },
  ]) {
    const pack = readSunReferences(); mutate(pack);
    assert.throws(() => compareSunReferences(pack), /solar reference contract/);
  }
});
