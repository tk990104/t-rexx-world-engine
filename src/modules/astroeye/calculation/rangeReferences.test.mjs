import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { horizonsUrl, parseHorizonsResponse, readReference, SAMPLE_INSTANTS, POSITION_LIMIT_ARCSECONDS, MOTION_LIMIT_DEGREES_PER_DAY } from '../../../../scripts/astroeye-horizons.mjs';
import { RANGE_BODIES, RANGE_CENTERS, RANGE_SAMPLES, validateRangeReference, readRangeReference, compareRangeReference, compareMoonTimeConventions } from '../../../../scripts/astroeye-range-references.mjs';
import { calculateAstronomyEnginePositions } from './astronomyEngineProvider.js';
import { compareUtcTtReference } from '../../../../scripts/astroeye-utc-tt-validation.mjs';

for (const body of RANGE_BODIES) {
  test(`range reference provenance and nine exact epochs: ${body}`, () => {
    const fixture = readRangeReference(body);
    assert.equal(fixture.rows.length, 9);
    assert.deepEqual(fixture.rows.map((row) => row.instant), RANGE_SAMPLES);
    assert.equal(fixture.requestUrl, horizonsUrl(body, RANGE_SAMPLES));
    assert.match(fixture.response.result, /source: DE441/);
    assert.match(fixture.response.result, /Times PRIOR to 1962 are UT1/);
    assert.match(fixture.response.result, /last known leap-second is used as a constant/);
  });
  test(`model-4 range coordinate accuracy gate: ${body}`, () => {
    const result = compareUtcTtReference(body, { range: true });
    for (const sample of result.samples) {
      assert.ok(sample.longitudeErrorArcseconds <= POSITION_LIMIT_ARCSECONDS,
        `${body} ${sample.instant}: longitude error ${sample.longitudeErrorArcseconds} arcseconds`);
      assert.ok(sample.latitudeErrorArcseconds <= POSITION_LIMIT_ARCSECONDS);
    }
    assert.equal(result.passed, true);
  });
}

test('range motion screening passes all nine center samples without changing limits', () => {
  assert.equal(POSITION_LIMIT_ARCSECONDS, 60);
  assert.equal(MOTION_LIMIT_DEGREES_PER_DAY, 0.07);
  for (const body of RANGE_BODIES) {
    const { motions } = compareRangeReference(body);
    assert.deepEqual(motions.map((motion) => motion.instant), RANGE_CENTERS);
    for (const motion of motions) {
      assert.ok(motion.errorDegreesPerDay <= MOTION_LIMIT_DEGREES_PER_DAY);
      if (motion.decisive) assert.equal(motion.directionMatches, true);
    }
  }
});

test('legacy-model range screening preserves the late-2100 Moon discrepancy', () => {
  const result = compareRangeReference('Moon');
  assert.equal(result.passed, false);
  assert.deepEqual(result.samples.filter((s) => s.longitudeErrorArcseconds > POSITION_LIMIT_ARCSECONDS).map((s) => s.instant), RANGE_SAMPLES.slice(6));
  assert.ok(result.samples.every((s) => s.latitudeErrorArcseconds <= POSITION_LIMIT_ARCSECONDS));
});

test('time-convention diagnostic explains most of the Moon gap without mutating production', () => {
  const before = RANGE_SAMPLES.slice(6).map(calculateAstronomyEnginePositions);
  const diagnostics = compareMoonTimeConventions();
  assert.equal(diagnostics.length, 3);
  for (const row of diagnostics) {
    assert.ok(row.defaultDeltaTSeconds > 205 && row.defaultDeltaTSeconds < 206);
    assert.ok(row.helperDeltaTSeconds > 69 && row.helperDeltaTSeconds < 71);
    assert.ok(row.diagnosticLongitudeErrorArcseconds < 2);
  }
  assert.deepEqual(RANGE_SAMPLES.slice(6).map(calculateAstronomyEnginePositions), before);
  assert.equal(compareRangeReference('Moon').passed, false);
});

test('legacy-model range diagnostic exits nonzero for its preserved discrepancy', () => {
  const command = fileURLToPath(new URL('../../../../scripts/astroeye-range-references.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [command], { timeout: 15000, encoding: 'utf8', windowsHide: true });
  assert.ifError(result.error);
  assert.equal(result.status, 1, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout).results.map((r) => [r.body, r.passed]), [['Sun', true], ['Moon', false], ['Mercury', true]]);
});

test('range collector rejects substituted provenance and conventions', () => {
  const original = readRangeReference('Sun');
  const changes = [
    (f) => { f.body = 'Moon'; }, (f) => { f.requestUrl = horizonsUrl('Sun'); },
    (f) => { f.retrievedAt = '2026-09-13Tbad'; }, (f) => { f.retrievedAt = '2026-09-14T00:00:00Z'; },
    (f) => { f.response.signature.version = '1.3'; }, (f) => { f.response.signature.source = 'other'; },
    (f) => { f.response.result = f.response.result.replace('GEOCENTRIC', 'TOPOCENTRIC'); },
    (f) => { f.response.result = f.response.result.replace('NO (AIRLESS)', 'YES'); },
    (f) => { f.response.result = f.response.result.replace('Date_________JDUT', 'Date_________JDTDB'); },
  ];
  for (const change of changes) {
    const fixture = structuredClone(original);
    change(fixture);
    assert.throws(() => validateRangeReference(fixture, 'Sun'), /mismatch/);
  }
  assert.throws(() => readRangeReference('Pluto'), /Unsupported/);
});

test('custom-epoch parser rejects wrong targets, missing rows, epochs and columns', () => {
  const { response } = readRangeReference('Sun');
  const changed = (from, to) => ({ ...response, result: response.result.replace(from, to) });
  assert.throws(() => parseHorizonsResponse({ error: 'offline' }, 'Sun', RANGE_SAMPLES), /offline/);
  assert.throws(() => parseHorizonsResponse(response, 'Moon', RANGE_SAMPLES), /target/);
  assert.throws(() => parseHorizonsResponse(changed('Earth (399)', 'Mars (499)'), 'Sun', RANGE_SAMPLES), /observer/);
  assert.throws(() => parseHorizonsResponse(changed('2415020.750000000', '2415020.850000000'), 'Sun', RANGE_SAMPLES), /epoch/);
  assert.throws(() => parseHorizonsResponse(changed('ObsEcLat', 'other'), 'Sun', RANGE_SAMPLES), /columns/);
  assert.throws(() => parseHorizonsResponse(changed('280.4082572', 'n.a.'), 'Sun', RANGE_SAMPLES), /coordinates/);
  assert.throws(() => parseHorizonsResponse(changed(/2415020\.750000000[^\n]*\n/, ''), 'Sun', RANGE_SAMPLES), /count/);
});

test('custom sample lists are ordered, canonical, bounded and immutable', () => {
  assert.ok(Object.isFrozen(RANGE_SAMPLES) && Object.isFrozen(RANGE_CENTERS) && Object.isFrozen(RANGE_BODIES));
  for (const invalid of [[], null, Array(1), ['bad'], [1], [RANGE_SAMPLES[0], RANGE_SAMPLES[0]], [...RANGE_SAMPLES].reverse(), ['1900-01-01'], Array(101).fill(RANGE_SAMPLES[0])]) {
    assert.throws(() => horizonsUrl('Sun', invalid), /Invalid Horizons sample/);
    assert.throws(() => parseHorizonsResponse({}, 'Sun', invalid), /Invalid Horizons sample/);
  }
  assert.equal(readReference('Sun').requestUrl, horizonsUrl('Sun', SAMPLE_INSTANTS));
  assert.equal(readReference('Sun').rows.length, 15);
});
