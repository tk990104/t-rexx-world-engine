import assert from 'node:assert/strict';
import test from 'node:test';
import { comparePolarCandidate } from '../../../../scripts/astroeye-polar-candidate.mjs';

// Manufactured plumbing data, NOT independent astronomical reference values.
function synthetic() {
  return { schemaVersion: 1, source: { repository: 'https://github.com/astrorigin/swisseph',
    commit: '1090b1a0573cce6a981b468b4b8355ba64e23474', path: 'setest/t.exp', engineVersion: '2.10.03', retrievedOn: '2026-09-14' },
    toleranceArcseconds: 60, wholeSignToleranceArcseconds: 0,
    cases: [89.9, -89.9].flatMap((latitude) => ['equal', 'whole-sign'].flatMap((system) => [2456334.5, 2456334.75, 2456335, 2456335.25].map((jd, i) => ({
      section: `6.1.${(latitude > 0 ? (system === 'equal' ? 397 : 421) : (system === 'equal' ? 1237 : 1261)) + i * 3}`,
      jd, latitude, longitude: 0, system, rc: 0, utcInstant: new Date((jd - 2440587.5) * 86400000).toISOString(),
      ascendant: 0, midheaven: 90, cusps: Array.from({ length: 12 }, (_, n) => n * 30),
    })))) };
}
const fake = (args) => {
  assert.equal(args.calculationVersion, 4);
  return { angles: { ascendant: 0, midheaven: 90 }, cusps: Array.from({ length: 12 }, (_, n) => ({ longitude: n * 30 })) };
};
test('polar candidate checker covers sixteen cases without mutating input (synthetic plumbing)', () => {
  const pack = synthetic(), bytes = JSON.stringify(pack), report = comparePolarCandidate(pack, fake);
  assert.equal(report.results.length, 16);
  assert.equal(report.passed, true);
  assert.match(report.scope, /redistribution not cleared/);
  assert.equal(JSON.stringify(pack), bytes);
});
test('polar candidate contract rejects missing, duplicated, relabeled or malformed data', () => {
  for (const mutate of [
    (p) => p.cases.pop(), (p) => { p.cases[1] = p.cases[0]; }, (p) => { p.toleranceArcseconds = 120; },
    (p) => { p.source.commit = 'other'; }, (p) => { p.cases[0].rc = -1; },
    (p) => { p.cases[0].latitude = 80; }, (p) => { p.cases[0].section = '6.1.1'; },
    (p) => { p.cases[0].utcInstant = '2013-02-12T00:00:00.000Z'; }, (p) => { p.cases[0].cusps[1] = NaN; },
  ]) { const pack = synthetic(); mutate(pack); assert.throws(() => comparePolarCandidate(pack, fake), /reference contract/); }
});
test('polar candidate checker rejects wrong antipodes, cusps and nonfinite outputs', () => {
  for (const change of [
    (r) => { r.angles.ascendant = 180; }, (r) => { r.angles.midheaven += 1; },
    (r) => { r.cusps[0].longitude += 1; }, (r) => { r.angles.ascendant = NaN; },
  ]) assert.equal(comparePolarCandidate(synthetic(), (args) => { const r = fake(args); change(r); return r; }).passed, false);
});
test('polar candidate checker keeps Whole Sign exact while using the preselected Equal screen', () => {
  const report = comparePolarCandidate(synthetic(), (args) => {
    const r = fake(args); r.cusps[0].longitude = 0.001; return r;
  });
  assert.ok(report.results.filter((r) => r.system === 'equal').every((r) => r.passed));
  assert.ok(report.results.filter((r) => r.system === 'whole-sign').every((r) => !r.passed));
});
