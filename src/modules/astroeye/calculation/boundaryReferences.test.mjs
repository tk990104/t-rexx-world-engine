import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { BOUNDARY_CENTERS, boundarySamples, readBoundaryReference, validateBoundaryReference, compareBoundaryReference } from '../../../../scripts/astroeye-boundary-references.mjs';
import { horizonsUrl, POSITION_LIMIT_ARCSECONDS, MOTION_LIMIT_DEGREES_PER_DAY } from '../../../../scripts/astroeye-horizons.mjs';
import { calculateUtcTtPositions } from './utcTtPositions.js';
import { calculateAstroEyeChart } from './chart.js';
import { eventFromDraft } from '../workspaceController.js';

const positionAt = (body, instant) => calculateUtcTtPositions(instant).positions.find((p) => p.body === body);
test('boundary scope pins 27 epochs and nine centers before comparison', () => {
  assert.deepEqual(Object.keys(BOUNDARY_CENTERS), ['Sun', 'Mercury']);
  assert.ok(Object.isFrozen(BOUNDARY_CENTERS));
  assert.equal(boundarySamples('Sun').length, 9);
  assert.equal(boundarySamples('Mercury').length, 18);
  assert.equal(BOUNDARY_CENTERS.Sun.length + BOUNDARY_CENTERS.Mercury.length, 9);
  assert.equal(POSITION_LIMIT_ARCSECONDS, 60);
  assert.equal(MOTION_LIMIT_DEGREES_PER_DAY, 0.07);
  assert.throws(() => boundarySamples('Moon'), /Unsupported/);
  assert.throws(() => readBoundaryReference('../Sun'), /Unsupported/);
  const copy = boundarySamples('Sun'); copy.reverse();
  assert.deepEqual(boundarySamples('Sun'), [...copy].reverse());
});
for (const body of Object.keys(BOUNDARY_CENTERS)) {
  test(`boundary source provenance and exact ordered epochs: ${body}`, () => {
    assert.ok(Object.isFrozen(BOUNDARY_CENTERS[body]));
    const fixture = readBoundaryReference(body);
    assert.equal(fixture.requestUrl, horizonsUrl(body, boundarySamples(body)));
    assert.deepEqual(fixture.rows.map((row) => row.instant), boundarySamples(body));
    assert.match(fixture.response.result, /Times AFTER 1962 are in UTC/);
  });
  test(`model-4 boundary coordinates and motion pass unchanged limits: ${body}`, () => {
    assert.equal(compareBoundaryReference(body).passed, true);
  });
  test(`full model-4 charts pass boundary references: ${body}`, () => {
    const before = JSON.stringify(readBoundaryReference(body));
    const report = compareBoundaryReference(body, (instant) => {
      const event = eventFromDraft({ id: 'boundary-qa', title: 'Synthetic boundary', sport: 'Demo', competition: 'QA',
        home: 'A', away: 'B', localDate: instant.slice(0, 10), localTime: instant.slice(11, 19), timeZone: 'UTC',
        venueName: 'Synthetic', latitude: 40, longitude: -75 });
      const chart = calculateAstroEyeChart(event);
      assert.equal(chart.calculationVersion, 4);
      const position = chart.positions.find((p) => p.body === body);
      assert.equal(position.signIndex, Math.floor(position.longitude / 30));
      assert.equal(position.sign, ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'][position.signIndex]);
      return position;
    });
    assert.equal(report.passed, true);
    assert.equal(JSON.stringify(readBoundaryReference(body)), before);
  });
}
test('Sun wrap has decisive Pisces/Aries sides and one explicitly inconclusive sign', () => {
  const { rows } = readBoundaryReference('Sun');
  assert.ok(rows[0].longitude > 359 && rows.at(-1).longitude < 1);
  const report = compareBoundaryReference('Sun');
  assert.deepEqual(report.samples.filter((s) => !s.signDecisive).map((s) => s.instant), ['2024-03-20T03:00:00.000Z']);
  assert.ok(report.motions.every((m) => m.expected > 0.9 && m.expected < 1.1 && m.decisive && m.directionMatches));
  const oppositeNearSide = compareBoundaryReference('Sun', (instant) => ({ ...positionAt('Sun', instant),
    ...(instant === '2024-03-20T03:00:00.000Z' ? { longitude: 0.004 } : {}) }));
  assert.equal(oppositeNearSide.passed, true); // Within coordinate tolerance; sign is not certified.
  assert.equal(oppositeNearSide.samples.find((s) => !s.signDecisive).signMatches, false);
});
test('Mercury brackets both reversals but refuses decisive claims at two slow centers', () => {
  const report = compareBoundaryReference('Mercury');
  assert.deepEqual(report.motions.map((m) => m.decisive), [true, false, true, true, false, true]);
  assert.deepEqual(report.motions.filter((m) => m.decisive).map((m) => Math.sign(m.expected)), [1, -1, -1, 1]);
  const ambiguousFlips = compareBoundaryReference('Mercury', (instant) => {
    const p = positionAt('Mercury', instant);
    return { ...p, retrograde: report.motions.some((m) => m.instant === instant && !m.decisive) ? !p.retrograde : p.retrograde };
  });
  assert.equal(ambiguousFlips.passed, true); // Not exact station-time or near-zero direction certification.
  assert.equal(ambiguousFlips.motions.filter((m) => !m.directionMatches).length, 2);
});
test('boundary gate rejects shifted coordinates, frozen motion and wrong decisive direction', () => {
  for (const mutate of [
    (p) => ({ ...p, longitude: (p.longitude + 1) % 360 }),
    (p) => ({ ...p, latitude: p.latitude + 1 }),
    (p) => ({ ...p, motionDegPerDay: 0 }),
    (p) => ({ ...p, retrograde: !p.retrograde }),
    (p) => ({ ...p, longitude: NaN }),
  ]) assert.equal(compareBoundaryReference('Mercury', (instant) => mutate(positionAt('Mercury', instant))).passed, false);
  const frozen = positionAt('Sun', boundarySamples('Sun')[0]);
  assert.equal(compareBoundaryReference('Sun', () => frozen).passed, false);
});
test('boundary source validator refuses changed provenance, conventions and samples', () => {
  for (const change of [
    (f) => { f.body = 'Moon'; }, (f) => { f.requestUrl = horizonsUrl('Sun'); },
    (f) => { f.retrievedAt = '2026-09-14T00:00:00Z'; },
    (f) => { f.response.signature.version = '1.3'; }, (f) => { f.response.signature.source = 'Other'; },
    (f) => { f.response.result = f.response.result.replace('GEOCENTRIC', 'TOPOCENTRIC'); },
    (f) => { f.response.result = f.response.result.replace('NO (AIRLESS)', 'YES'); },
    (f) => { f.response.result = f.response.result.replace('Date_________JDUT', 'Date_________JDTDB'); },
    (f) => { f.response.result = f.response.result.replace('{source: DE441}', '{source: DE440}'); },
    (f) => { f.response.result = f.response.result.replace(/(Center body name:[^\n]*)DE441/, '$1DE440'); },
    (f) => { f.response.result = f.response.result.replace('eop.260911.p261208', 'eop.other'); },
    (f) => { f.response.result = f.response.result.replace('2460388.750000000', '2460388.850000000'); },
    (f) => { f.response.result = f.response.result.replace(/2460388\.750000000[^\n]*\n/, ''); },
  ]) {
    const fixture = structuredClone(readBoundaryReference('Sun')); change(fixture);
    assert.throws(() => validateBoundaryReference(fixture, 'Sun'), /mismatch/);
  }
});
test('offline boundary command succeeds with explicit active-model identity', () => {
  const script = fileURLToPath(new URL('../../../../scripts/astroeye-boundary-references.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [script], { timeout: 15000, encoding: 'utf8', windowsHide: true });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.calculationVersion, 4);
  assert.deepEqual(report.results.map((r) => [r.body, r.passed]), [['Sun', true], ['Mercury', true]]);
});
