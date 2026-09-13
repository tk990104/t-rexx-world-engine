import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateAnglesFromOrientation } from './houses.js';

const rad = (v) => v * Math.PI / 180;
const projectEast = (longitude, theta, obliquity) =>
  -Math.cos(rad(longitude)) * Math.sin(rad(theta))
  + Math.sin(rad(longitude)) * Math.cos(rad(obliquity)) * Math.cos(rad(theta));

test('model 2 corrects both legacy western branches while retaining the MC convention', () => {
  for (const [latitude, theta] of [[80, 270], [-80, 90], [89.9999, 270], [-89.9999, 90]]) {
    const legacy = calculateAnglesFromOrientation(theta, latitude, 23.44, { calculationVersion: 1 });
    const modern = calculateAnglesFromOrientation(theta, latitude, 23.44);
    assert.ok(projectEast(legacy.ascendant, theta, 23.44) < -0.99);
    assert.ok(projectEast(modern.ascendant, theta, 23.44) > 0.99);
    assert.ok(Math.abs(Math.abs(modern.ascendant - legacy.ascendant) - 180) < 1e-10);
    assert.equal(modern.midheaven, legacy.midheaven);
  }
});

test('model 2 preserves ordinary orientations exactly and refuses unknown versions', () => {
  for (const latitude of [-60, -40, 0, 40, 60]) {
    for (const theta of [0, 45, 90, 180, 225, 270, 359.999]) {
      assert.deepEqual(calculateAnglesFromOrientation(theta, latitude, 23.44),
        calculateAnglesFromOrientation(theta, latitude, 23.44, { calculationVersion: 1 }));
    }
  }
  for (const calculationVersion of [0, 3, null, '2']) {
    assert.throws(() => calculateAnglesFromOrientation(270, 80, 23.44, { calculationVersion }), /version/);
  }
});

test('coincident and numerically near-coincident planes fail explicitly; nearby stable orientations work', () => {
  for (const [latitude, theta] of [[66.56, 270], [-66.56, 90]]) {
    for (const offset of [0, -1e-9, 1e-9]) {
      assert.throws(() => calculateAnglesFromOrientation(theta, latitude + offset, 23.44), /Angles unavailable/);
      assert.ok(Number.isFinite(calculateAnglesFromOrientation(theta, latitude + offset, 23.44,
        { calculationVersion: 1 }).ascendant), 'legacy replay retains its original result');
    }
    for (const offset of [-0.001, 0.001]) {
      const angles = calculateAnglesFromOrientation(theta, latitude + offset, 23.44);
      assert.ok(projectEast(angles.ascendant, theta, 23.44) > 0);
    }
  }
});

test('a tangent with no stable east/west selection is unavailable in both hemispheres', () => {
  for (const latitude of [-80, 80]) {
    const theta = Math.asin(-1 / (Math.tan(rad(latitude)) * Math.tan(rad(23.44)))) * 180 / Math.PI;
    assert.throws(() => calculateAnglesFromOrientation(theta, latitude, 23.44), /Angles unavailable/);
    for (const offset of [-0.001, 0.001]) {
      const angles = calculateAnglesFromOrientation(theta + offset, latitude, 23.44);
      assert.ok(projectEast(angles.ascendant, theta + offset, 23.44) > 0);
    }
  }
});
