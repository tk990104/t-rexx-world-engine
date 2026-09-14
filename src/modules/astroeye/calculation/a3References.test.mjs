import assert from 'node:assert/strict';
import test from 'node:test';
import { A3_PACKS, summarizeA3References, evaluateA3References } from '../../../../scripts/astroeye-a3-references.mjs';

const synthetic = () => A3_PACKS.map((p) => ({ pack: p.pack, body: p.body, passed: true,
  samples: Array.from({ length: p.positions }, () => ({ longitudeErrorArcseconds: 0, latitudeErrorArcseconds: 0,
    ...(p.pack.includes('boundary') ? { signDecisive: true, signMatches: true } : {}) })),
  motions: Array.from({ length: p.motions }, () => ({ errorDegreesPerDay: 0, decisive: true, directionMatches: true })) }));
test('A3 consolidated offline report covers every approved reference pack and preserves limits', () => {
  const report = evaluateA3References();
  assert.deepEqual([report.packCount, report.positionCount, report.coordinateCount, report.motionCount], [24, 303, 606, 101]);
  assert.equal(report.calculationVersion, 4);
  assert.equal(report.passed, true);
  assert.deepEqual(report.supportedUtcInterval, ['1900-01-01T00:00:00.000Z', '2101-01-01T00:00:00.000Z']);
  assert.deepEqual(report.limits, { coordinateArcseconds: 60, motionDegreesPerDay: 0.07 });
  assert.match(report.referenceSha256, /^[a-f0-9]{64}$/);
  assert.match(report.scope, /not whole-release certification/);
  assert.equal(report.summaries.reduce((n, s) => n + s.inconclusiveSigns, 0), 1);
  assert.equal(report.summaries.reduce((n, s) => n + s.signChecks, 0), 63);
});
test('A3 reporting rejects missing, duplicated, reordered or smaller coverage', () => {
  assert.ok(Object.isFrozen(A3_PACKS) && A3_PACKS.every(Object.isFrozen));
  for (const alter of [(r) => r.pop(), (r) => r.reverse(), (r) => { r[1] = r[0]; }, (r) => r[0].samples.pop(), (r) => r[0].motions.pop()]) {
    const results = synthetic(); alter(results);
    assert.throws(() => summarizeA3References(results), /coverage mismatch/);
  }
});
test('A3 reporting cannot hide a failed or invalid comparison behind a passed flag', () => {
  for (const alter of [
    (r) => { r[0].passed = false; }, (r) => { r[0].samples[0].longitudeErrorArcseconds = 61; },
    (r) => { r[0].samples[0].latitudeErrorArcseconds = NaN; },
    (r) => { r[0].motions[0].errorDegreesPerDay = 0.071; },
    (r) => { r[0].motions[0].directionMatches = false; },
    (r) => { delete r[20].samples[0].signDecisive; },
  ]) {
    const results = synthetic(); alter(results);
    assert.equal(summarizeA3References(results).passed, false);
  }
  const results = synthetic(), bytes = JSON.stringify(results);
  assert.equal(summarizeA3References(results).passed, true);
  assert.equal(JSON.stringify(results), bytes);
});
