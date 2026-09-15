import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeTimings } from './qa-performance-stats.mjs';

test('summarizes odd/even samples without mutating their order', () => {
  const input = [5, 1, 3];
  assert.deepEqual(summarizeTimings(input), { samples: 3, minMs: 1, medianMs: 3, p95Ms: 5, maxMs: 5 });
  assert.deepEqual(input, [5, 1, 3]);
  assert.equal(summarizeTimings([4, 1, 3, 2]).medianMs, 2.5);
});
test('uses nearest rank p95 and rounds only reported values', () => {
  assert.equal(summarizeTimings(Array.from({ length: 20 }, (_, i) => i + 1)).p95Ms, 19);
  assert.equal(summarizeTimings([0.123456]).medianMs, 0.123);
  assert.equal(summarizeTimings([0]).maxMs, 0);
});
test('refuses absent, invalid or negative timing samples', () => {
  for (const input of [null, [], [NaN], [Infinity], [-1], ['2']]) assert.throws(() => summarizeTimings(input), TypeError);
});
