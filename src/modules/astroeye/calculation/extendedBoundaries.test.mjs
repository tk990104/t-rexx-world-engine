import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { EXTENDED_CENTERS, extendedSamples, readExtendedReference, validateExtendedReference, compareExtendedReference } from '../../../../scripts/astroeye-extended-boundaries.mjs';
import { readBoundaryReference, validateBoundaryReference } from '../../../../scripts/astroeye-boundary-references.mjs';
import { horizonsUrl, signedDelta, POSITION_LIMIT_ARCSECONDS, MOTION_LIMIT_DEGREES_PER_DAY } from '../../../../scripts/astroeye-horizons.mjs';
import { calculateAstroEyeChart } from './chart.js';
import { calculateUtcTtPositions } from './utcTtPositions.js';
import { chartTimePolicyNote } from './timeConventions.js';
import { eventFromDraft } from '../workspaceController.js';

test('extended boundary scope is frozen and ordered with 36 positions and twelve centers', () => {
  assert.ok(Object.isFrozen(EXTENDED_CENTERS));
  assert.deepEqual(Object.keys(EXTENDED_CENTERS), ['Sun', 'Mercury']);
  assert.deepEqual(Object.values(EXTENDED_CENTERS).map((c) => c.length), [4, 8]);
  assert.equal(POSITION_LIMIT_ARCSECONDS, 60);
  assert.equal(MOTION_LIMIT_DEGREES_PER_DAY, 0.07);
  assert.throws(() => extendedSamples('Moon'), /Unsupported/);
  assert.throws(() => readExtendedReference('../Sun'), /Unsupported/);
});
for (const body of Object.keys(EXTENDED_CENTERS)) {
  test(`extended snapshot keeps exact epochs and historical/future conventions: ${body}`, () => {
    const fixture = readExtendedReference(body);
    assert.ok(Object.isFrozen(EXTENDED_CENTERS[body]));
    assert.equal(fixture.rows.length, body === 'Sun' ? 12 : 24);
    assert.deepEqual(fixture.rows.map((r) => r.instant), extendedSamples(body));
    assert.equal(fixture.requestUrl, horizonsUrl(body, extendedSamples(body)));
    assert.match(fixture.response.result, /Times PRIOR to 1962 are UT1/);
    assert.match(fixture.response.result, /last known leap-second is used as a constant/);
    assert.equal(compareExtendedReference(body).passed, true);
  });
  test(`full charts pass extended references and retain time-policy cautions: ${body}`, () => {
    const report = compareExtendedReference(body, (instant) => {
      const event = eventFromDraft({ id: 'extended-boundary-qa', title: 'Synthetic boundary', sport: 'Demo', competition: 'QA',
        home: 'A', away: 'B', localDate: instant.slice(0, 10), localTime: instant.slice(11, 19), timeZone: 'UTC',
        venueName: 'Synthetic', latitude: 40, longitude: -75 });
      const inputBytes = JSON.stringify(event);
      const chart = calculateAstroEyeChart(event);
      assert.equal(chart.calculationVersion, 4);
      assert.equal(JSON.stringify(event), inputBytes);
      const year = instant.slice(0, 4);
      assert.equal(chart.timeConventions.positions.basis, year === '1900' ? 'historical-ut1-estimate'
        : year === '2100' ? 'future-held-leap-seconds' : 'published-utc-offset');
      if (year === '1900') assert.match(chartTimePolicyNote(chart), /historical timing is approximate/);
      if (year === '2100') assert.match(chartTimePolicyNote(chart), /Future leap seconds are unknown/);
      const actual = chart.positions.find((p) => p.body === body);
      assert.equal(actual.signIndex, Math.floor(actual.longitude / 30));
      if (body === 'Sun' || year === '2025') assert.equal(actual.sign, actual.signIndex === 0 ? 'Aries' : 'Pisces');
      return actual;
    });
    assert.equal(report.passed, true);
  });
}
test('1900 and 2100 Sun samples bracket forward zero-degree crossings decisively', () => {
  const { rows } = readExtendedReference('Sun');
  for (const year of ['1900', '2100']) {
    const group = rows.filter((r) => r.instant.startsWith(year));
    assert.ok(group.slice(0, 3).every((r) => r.longitude > 358));
    assert.ok(group.slice(3).every((r) => r.longitude < 2));
    assert.ok(signedDelta(group[0].longitude, group.at(-1).longitude) > 0);
  }
  const report = compareExtendedReference('Sun');
  assert.ok(report.samples.every((s) => s.signDecisive && s.signMatches));
  assert.ok(report.motions.every((m) => m.expected > 0 && m.decisive && m.directionMatches));
});
test('historical/future Mercury reversals preserve inconclusive near-station directions', () => {
  const report = compareExtendedReference('Mercury');
  for (const year of ['1900', '2100']) {
    const group = report.motions.filter((m) => m.instant.startsWith(year));
    assert.deepEqual(group.map((m) => m.decisive), [true, false, true]);
    assert.ok(group[0].expected > 0 && group[2].expected < 0);
  }
  const changed = compareExtendedReference('Mercury', (instant) => {
    const p = calculateUtcTtPositions(instant).positions.find((p) => p.body === 'Mercury');
    return { ...p, retrograde: report.motions.some((m) => m.instant === instant && !m.decisive) ? !p.retrograde : p.retrograde };
  });
  assert.equal(changed.passed, true);
  assert.equal(changed.motions.filter((m) => !m.directionMatches).length, 2);
});
test('2025 Mercury crosses from Aries into Pisces while moving retrograde on both flanks', () => {
  const rows = readExtendedReference('Mercury').rows.filter((r) => r.instant.startsWith('2025'));
  assert.ok(rows.slice(0, 3).every((r) => r.longitude > 0 && r.longitude < 2));
  assert.ok(rows.slice(3).every((r) => r.longitude > 358));
  assert.ok(signedDelta(rows[0].longitude, rows.at(-1).longitude) < 0);
  const report = compareExtendedReference('Mercury');
  assert.ok(report.samples.filter((s) => s.instant.startsWith('2025')).every((s) => s.signDecisive && s.signMatches));
  assert.ok(report.motions.filter((m) => m.instant.startsWith('2025')).every((m) => m.decisive && m.expected < 0 && m.directionMatches));
});
test('extended gate rejects wrong coordinates and decisive retrograde flags', () => {
  for (const mutate of [(p) => ({ ...p, longitude: (p.longitude + 1) % 360 }), (p) => ({ ...p, retrograde: !p.retrograde })]) {
    assert.equal(compareExtendedReference('Mercury', (instant) => mutate(calculateUtcTtPositions(instant).positions.find((p) => p.body === 'Mercury'))).passed, false);
  }
});
test('separate source snapshots cannot replace one another or silently change conventions', () => {
  assert.throws(() => validateExtendedReference(readBoundaryReference('Sun'), 'Sun'), /mismatch/);
  assert.throws(() => validateBoundaryReference(readExtendedReference('Sun'), 'Sun'), /mismatch/);
  for (const mutate of [
    (f) => { f.retrievedAt = '2026-09-13T00:00:00Z'; },
    (f) => { f.response.signature.version = '1.3'; },
    (f) => { f.response.result = f.response.result.replace('eop.260911.p261208', 'other'); },
    (f) => { f.response.result = f.response.result.replace('NO (AIRLESS)', 'YES'); },
    (f) => { f.response.result = f.response.result.replace('2415098.750000000', '2415098.850000000'); },
  ]) {
    const fixture = structuredClone(readExtendedReference('Sun')); mutate(fixture);
    assert.throws(() => validateExtendedReference(fixture, 'Sun'), /mismatch/);
  }
});
test('extended offline command identifies model 4 and all twelve motion centers pass', () => {
  const script = fileURLToPath(new URL('../../../../scripts/astroeye-extended-boundaries.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [script], { timeout: 15000, encoding: 'utf8', windowsHide: true });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.calculationVersion, 4);
  assert.deepEqual(report.results.map((r) => [r.body, r.samples.length, r.motions.length, r.passed]), [['Sun', 12, 4, true], ['Mercury', 24, 8, true]]);
});
