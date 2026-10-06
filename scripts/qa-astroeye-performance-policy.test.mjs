import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewPerformanceSamples } from './qa-astroeye-performance-policy.mjs';
test('local timing budget includes its boundaries and retains every sample', () => {
  const value = reviewPerformanceSamples([1, 500, 2000]);
  assert.equal(value.accepted, true); assert.equal(value.maximumMs, 2000);
  assert.deepEqual(value.rawMs, [1, 500, 2000]);
});
test('median and worst observed latency must both pass', () => {
  assert.equal(reviewPerformanceSamples([1, 501, 502]).accepted, false);
  assert.equal(reviewPerformanceSamples([1, 500.0001, 501]).accepted, false);
  assert.equal(reviewPerformanceSamples([1, 2, 2001]).accepted, false);
});
test('missing, nonfinite and insufficient data cannot pass', () => {
  for (const values of [null, [], [1, 2], [1, -1, 2], [1, NaN, 2], [1, Infinity, 2]]) {
    assert.throws(() => reviewPerformanceSamples(values), TypeError);
  }
});
