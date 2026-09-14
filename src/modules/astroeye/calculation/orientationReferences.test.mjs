import assert from 'node:assert/strict';
import test from 'node:test';
import { readOrientationReferences, compareOrientationReferences } from '../../../../scripts/astroeye-orientation-references.mjs';
import { calculateAnglesFromOrientation } from './houses.js';

test('published orientation assertions cover four Ascendants and eleven quadrant/wrap Midheavens', () => {
  const pack = readOrientationReferences(), before = JSON.stringify(pack), report = compareOrientationReferences(pack);
  assert.equal(report.results.length, 15);
  assert.equal(report.results.filter((r) => r.component === 'ascendant').length, 4);
  assert.ok(report.passed, JSON.stringify(report));
  assert.match(report.scope, /A1 remains open/);
  assert.equal(JSON.stringify(pack), before);
});

test('orientation contract rejects changed coverage, inputs, source, convention and tolerance', () => {
  for (const mutate of [
    (p) => p.cases.pop(), (p) => { p.cases[1] = p.cases[0]; }, (p) => p.cases.reverse(),
    (p) => { p.cases[0].latitude *= -1; }, (p) => { p.cases[0].localSiderealDegrees += 1; },
    (p) => { p.cases[0].expected = NaN; }, (p) => { p.source.commit = 'other'; },
    (p) => { p.source.license = 'MIT'; }, (p) => { p.obliquityDegrees = 23.44; },
    (p) => { p.toleranceArcseconds = 60; },
  ]) { const pack = readOrientationReferences(); mutate(pack); assert.throws(() => compareOrientationReferences(pack), /reference contract/); }
});

test('orientation comparison rejects altered expected values, wrong antipodes and nonfinite results', () => {
  const pack = readOrientationReferences(); pack.cases[0].expected += 1 / 3600;
  assert.equal(compareOrientationReferences(pack).passed, false);
  for (const transform of [(v) => (v + 180) % 360, () => NaN, () => Infinity, () => undefined]) {
    const report = compareOrientationReferences(readOrientationReferences(), (...args) => {
      const r = calculateAnglesFromOrientation(...args);
      return { ascendant: transform(r.ascendant), midheaven: transform(r.midheaven) };
    });
    assert.equal(report.passed, false);
    assert.ok(report.results.every((r) => !r.passed));
  }
});

test('internal wrap equivalence preserves independently referenced orientations', () => {
  const pack = readOrientationReferences();
  for (const offset of [-720, -360, 360, 720]) {
    const report = compareOrientationReferences(pack, (theta, ...args) => calculateAnglesFromOrientation(theta + offset, ...args));
    assert.ok(report.passed, JSON.stringify(report));
  }
});
