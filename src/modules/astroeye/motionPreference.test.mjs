import assert from 'node:assert/strict';
import test from 'node:test';
import { astroEyeMotionDuration, astroEyeVenueOptions } from './motionPreference.js';

test('reduced motion uses zero duration and rereads preference on each action', () => {
  let reduced = false, reads = 0;
  const host = { matchMedia(query) { assert.equal(this, host); assert.equal(query, '(prefers-reduced-motion: reduce)'); reads++; return { matches: reduced }; } };
  assert.equal(astroEyeMotionDuration(2.4, host), 2.4);
  reduced = true; assert.equal(astroEyeMotionDuration(2.4, host), 0);
  reduced = false; assert.equal(astroEyeMotionDuration(1.8, host), 1.8);
  assert.equal(reads, 3);
});
test('missing or failing preference keeps established duration; truthy strings are not preferences', () => {
  for (const host of [null, {}, { matchMedia() { throw new Error('unavailable'); } },
    { matchMedia: () => null }, { matchMedia: () => ({ matches: 'true' }) }]) {
    assert.equal(astroEyeMotionDuration(2.4, host), 2.4);
  }
});
test('venue command and presenter options retain identical geometry, with detached objects', () => {
  const normal = astroEyeVenueOptions((seconds) => seconds), reduced = astroEyeVenueOptions(() => 0);
  assert.deepEqual(normal, { range: 12000, pitch: -42, heading: 12, buildingHeight: 0, duration: 2.4 });
  assert.deepEqual(reduced, { ...normal, duration: 0 });
  reduced.range = 1; assert.equal(astroEyeVenueOptions(() => 0).range, 12000);
});
