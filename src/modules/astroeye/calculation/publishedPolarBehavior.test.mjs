import assert from 'node:assert/strict';
import test from 'node:test';
import { comparePolarBehavior, readPolarBehaviorReference } from '../../../../scripts/astroeye-polar-references.mjs';
import { calculateAnglesFromOrientation } from './houses.js';

test('model 2 matches the published northern polar ranges, motions and two jumps', () => {
  const pack = readPolarBehaviorReference(), before = JSON.stringify(pack);
  const result = comparePolarBehavior(pack);
  assert.equal(result.scope, 'orientation-behavior-only');
  assert.equal(result.samples, 720);
  assert.equal(result.passed, true, JSON.stringify(result));
  assert.equal(JSON.stringify(pack), before);
});

test('published behavior rejects the preserved legacy branch rather than blessing both models', () => {
  const result = comparePolarBehavior(undefined, (theta, lat, eps) =>
    calculateAnglesFromOrientation(theta, lat, eps, { calculationVersion: 1 }));
  assert.equal(result.passed, false);
  assert.ok(result.motionFailures > 0);
});

test('wrong antipodes, frozen outputs and missing numbers cannot pass the reference', () => {
  for (const calculate of [
    (theta, lat, eps) => ({ ascendant: (calculateAnglesFromOrientation(theta, lat, eps).ascendant + 180) % 360 }),
    () => ({ ascendant: 180 }), () => ({ ascendant: null }), () => ({ ascendant: NaN }),
  ]) assert.equal(comparePolarBehavior(undefined, calculate).passed, false);
});

test('reference bounds, sampling, scope and provenance cannot silently change', () => {
  for (const mutate of [
    (p) => { p.source.url = 'https://example.com'; },
    (p) => { p.published.latitude = -78; },
    (p) => { p.published.equinoctialHalfWidthDegrees = 90; },
    (p) => { p.testConventions.boundToleranceDegrees = 2; },
    (p) => { p.testConventions.kind = 'utc-chart'; },
    (p) => { p.testConventions.siderealStepDegrees = 90; },
    (p) => { p.testConventions.adoptedObliquityDegrees = 0; },
  ]) {
    const pack = readPolarBehaviorReference(); mutate(pack);
    assert.throws(() => comparePolarBehavior(pack), /polar-reference/);
  }
});
