import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import * as Astronomy from 'astronomy-engine';
import data from './fixtures/utc-offsets-2026-09-13.json' with { type: 'json' };
import { ephemerisTimeInfo, makePositionEphemerisTime, EPHEMERIS_TIME_POLICY } from './ephemerisTime.js';
import { calculateUtcTtPositions } from './utcTtPositions.js';
import { calculateAstroEyeChart } from './chart.js';
import { ASTROEYE_CALCULATION_VERSION, requireCalculationVersion } from './modelVersion.js';
import { eventFromDraft } from '../workspaceController.js';
import { compareUtcTtReference } from '../../../../scripts/astroeye-utc-tt-validation.mjs';
import { HORIZONS_TARGETS, POSITION_LIMIT_ARCSECONDS, MOTION_LIMIT_DEGREES_PER_DAY } from '../../../../scripts/astroeye-horizons.mjs';
import { RANGE_BODIES, compareRangeReference } from '../../../../scripts/astroeye-range-references.mjs';

const close = (actual, expected, tolerance = 1e-8) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);
test('UTC offsets retain source provenance and independently listed IERS leap epochs', () => {
  assert.equal(data.url, 'https://maia.usno.navy.mil/ser7/tai-utc.dat');
  assert.equal(data.retrievedOn, '2026-09-13');
  assert.equal(data.rows.length, 39);
  const mjds = [41317,41499,41683,42048,42413,42778,43144,43509,43874,44239,44786,45151,45516,46247,47161,47892,48257,48804,49169,49534,50083,50630,51179,53736,54832,56109,57204,57754];
  data.rows.slice(11).forEach(([date, base, reference, drift], i) => {
    assert.equal(Date.parse(`${date}T00:00:00Z`) / 86400000 + 40587, mjds[i]);
    assert.equal(base, i + 10); assert.equal(reference, 41317); assert.equal(drift, 0);
  });
});
test('historical UTC includes published fractional offsets and drift', () => {
  for (const [instant, expected] of [
    ['1962-01-01T00:00:00Z', 34.029858], ['1962-07-01T00:00:00Z', 34.2331572],
    ['1968-02-01T00:00:00Z', 38.369682], ['1972-01-01T00:00:00Z', 42.184],
    ['2000-01-01T12:00:00Z', 64.184], ['2017-01-01T00:00:00Z', 69.184],
  ]) close(ephemerisTimeInfo(instant).ttMinusInputSeconds, expected);
  close(ephemerisTimeInfo('1962-01-01T12:00:00Z').ttMinusInputSeconds - ephemerisTimeInfo('1962-01-01T00:00:00Z').ttMinusInputSeconds, 0.0005616);
});
test('all post-1972 leap transitions are half-open and leap-second input is refused', () => {
  for (const [date, base] of data.rows.slice(12)) {
    const epoch = Date.parse(`${date}T00:00:00Z`);
    close(ephemerisTimeInfo(new Date(epoch - 1).toISOString()).ttMinusInputSeconds, base - 1 + 32.184);
    close(ephemerisTimeInfo(new Date(epoch).toISOString()).ttMinusInputSeconds, base + 32.184);
  }
  const before = ephemerisTimeInfo('2016-12-31T23:59:59.999Z');
  const after = ephemerisTimeInfo('2017-01-01T00:00:00.000Z');
  close((after.ttDays - before.ttDays) * 86400, 1.001, 1e-6);
  assert.throws(() => ephemerisTimeInfo('2016-12-31T23:59:60Z'), /Invalid/);
});
test('time metadata distinguishes historical estimates from provisional future offsets', () => {
  const old = ephemerisTimeInfo('1900-01-01T12:00:00Z');
  assert.equal(old.basis, 'historical-ut1-estimate');
  const ut = new Astronomy.AstroTime(new Date(old.inputInstant)).ut;
  close(old.ttMinusInputSeconds, Astronomy.DeltaT_EspenakMeeus(ut));
  assert.equal(ephemerisTimeInfo('2026-09-13T12:00:00Z').basis, 'published-utc-offset');
  const future = ephemerisTimeInfo('2100-12-31T12:00:00Z');
  close(future.ttMinusInputSeconds, 69.184);
  assert.equal(future.basis, 'future-held-leap-seconds');
  assert.ok(Object.isFrozen(future) && Object.isFrozen(EPHEMERIS_TIME_POLICY));
});
test('explicit TT survives light-time shifts without rewriting the library global delta T', () => {
  const date = new Date('2100-12-31T12:00:00Z'), original = new Astronomy.AstroTime(date);
  for (const instant of ['2017-01-01T00:00:00Z', date.toISOString()]) {
    const info = ephemerisTimeInfo(instant), time = makePositionEphemerisTime(instant);
    close(time.tt, info.ttDays, 1e-10);
    close(time.AddDays(-0.01).tt, info.ttDays - 0.01, 1e-10);
    close(time.AddDays(-0.01).AddDays(0.02).tt, info.ttDays + 0.01, 1e-10);
    assert.throws(() => time.AddDays(NaN), /Finite/);
    assert.throws(() => time.AddDays(1e9), /one day/);
    const result = calculateUtcTtPositions(instant);
    assert.equal(result.time.inputInstant, new Date(instant).toISOString());
    assert.ok(Object.isFrozen(result) && Object.isFrozen(result.positions));
    assert.equal(result.positions.length, 10);
  }
  assert.deepEqual(new Astronomy.AstroTime(date), original);
});
test('candidate rejects ambiguous, rolled-over and unsupported timestamps', () => {
  for (const invalid of [null, 0, {}, '', 'bad', '2026-01-01', '2026-01-01T00:00:00', '2026-01-01T01:00:00+01:00', '2026-02-30T00:00:00Z', '1900-01-01T24:00:00Z', '2026-01-01T00:00:00.1234Z', '1800-01-01T00:00:00Z', '2200-01-01T00:00:00Z']) {
    assert.throws(() => calculateUtcTtPositions(invalid));
  }
  assert.equal(calculateUtcTtPositions('1900-01-01T00:00:00Z').positions.length, 10);
  assert.equal(calculateUtcTtPositions('2100-12-31T23:59:59.999Z').positions.length, 10);
});
for (const range of [false, true]) {
  for (const body of range ? RANGE_BODIES : Object.keys(HORIZONS_TARGETS)) {
    test(`candidate UTC/TT matches unchanged ${range ? 'range' : 'original'} references: ${body}`, () => {
      assert.equal(POSITION_LIMIT_ARCSECONDS, 60); assert.equal(MOTION_LIMIT_DEGREES_PER_DAY, 0.07);
      const result = compareUtcTtReference(body, { range });
      assert.equal(result.passed, true, JSON.stringify(result));
    });
  }
}
test('activated position policy does not change any legacy chart bytes', () => {
  const charts = [];
  for (const localDate of ['1900-01-01','1950-06-21','2026-09-13','2100-12-31']) {
    calculateUtcTtPositions(`${localDate}T12:00:00Z`);
    for (const calculationVersion of [1,2,3]) {
      const event = eventFromDraft({ id: 'legacy-time-check', title: 'Synthetic', sport: 'Demo', competition: 'QA', home: 'A', away: 'B',
        localDate, localTime: '12:00', timeZone: 'UTC', venueName: 'Synthetic', latitude: 40, longitude: -75 });
      charts.push(calculateAstroEyeChart(event, { calculationVersion }));
    }
  }
  assert.equal(createHash('sha256').update(JSON.stringify(charts)).digest('hex'), '9d60b7ccb4c1d062f6b1b0effa222b8e694c53eb72ca0d3717b5455f8b317f67');
  assert.equal(ASTROEYE_CALCULATION_VERSION, 4);
  assert.throws(() => requireCalculationVersion(5), /Unsupported/);
  assert.equal(compareRangeReference('Moon').passed, false, 'Existing model discrepancy is not hidden by the candidate');
});
