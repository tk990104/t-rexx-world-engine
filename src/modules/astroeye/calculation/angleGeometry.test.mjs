import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { calculateAngles, calculateAnglesFromOrientation, calculateHouses } from './houses.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/horizon-orientation.json', import.meta.url), 'utf8'));
const rad = (value) => value * Math.PI / 180;
const wrap = (value) => ((value % 360) + 360) % 360;
const distance = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
const dms = ([d, m, s]) => d + m / 60 + s / 3600;

// Independent representation: rotate a unit ecliptic vector into equatorial axes,
// then project onto local up/east. This does not recalculate the atan2 formula.
function project(longitude, theta, latitude, obliquity) {
  const l = rad(longitude), t = rad(theta), p = rad(latitude), e = rad(obliquity);
  const x = Math.cos(l), y = Math.sin(l) * Math.cos(e), z = Math.sin(l) * Math.sin(e);
  return {
    up: x * Math.cos(p) * Math.cos(t) + y * Math.cos(p) * Math.sin(t) + z * Math.sin(p),
    east: -x * Math.sin(t) + y * Math.cos(t),
    meridianDirection: x * Math.cos(t) + y * Math.sin(t),
  };
}

test('published horizon fixture pins both intersections within its printed precision', () => {
  assert.equal(fixture.schemaVersion, 1);
  assert.equal(fixture.toleranceArcseconds, 0.1);
  const { localSiderealDegrees, latitude, trueObliquityDegrees } = fixture.input;
  const { ascendant } = calculateAnglesFromOrientation(localSiderealDegrees, latitude, trueObliquityDegrees);
  const expected = fixture.horizonIntersectionsDms.map(dms);
  assert.ok(distance(ascendant, expected[0]) * 3600 <= fixture.toleranceArcseconds);
  assert.ok(distance(wrap(ascendant + 180), expected[1]) * 3600 <= fixture.toleranceArcseconds);
  assert.ok(project(ascendant, localSiderealDegrees, latitude, trueObliquityDegrees).east > 0,
    'the selected intersection is eastern in this non-polar reference case');
});

test('reference guard detects wrong antipode and a one-arcsecond error', () => {
  const expected = dms(fixture.horizonIntersectionsDms[0]);
  assert.ok(distance(wrap(expected + 180), expected) * 3600 > fixture.toleranceArcseconds);
  assert.ok(distance(expected + 1 / 3600, expected) * 3600 > fixture.toleranceArcseconds);
});

test('orientation geometry satisfies horizon and meridian planes across hemispheres and wrap', () => {
  for (const latitude of [-80, -66, -51, 0, 51, 66, 80]) {
    for (const theta of [0, 0.001, 45, 75, 90, 179.999, 180, 225, 270, 359.999, 360]) {
      const angles = calculateAnglesFromOrientation(theta, latitude, 23.44);
      const asc = project(angles.ascendant, theta, latitude, 23.44);
      const mc = project(angles.midheaven, theta, latitude, 23.44);
      assert.ok(Math.abs(asc.up) < 1e-12, `horizon: ${latitude}/${theta}`);
      assert.ok(Math.abs(mc.east) < 1e-12, `meridian: ${latitude}/${theta}`);
      assert.ok(mc.meridianDirection > 0, 'MC has local sidereal RA, not opposite RA');
      // Geometric regression, not independent ephemeris accuracy certification.
      assert.ok(asc.east > 0, 'model 2 Ascendant is eastern');
    }
  }
});

test('cardinal meridians have exact geometric longitudes without an ephemeris reference', () => {
  for (const theta of [0, 90, 180, 270, 360]) {
    assert.ok(distance(calculateAnglesFromOrientation(theta, 0, 23.44).midheaven, wrap(theta)) < 1e-10);
  }
});

test('date-based wrapper and both house systems retain angle and cusp contracts', () => {
  for (const utcInstant of ['2000-01-01T12:00:00Z', '2028-02-29T00:00:00Z']) {
    for (const latitude of [-80, -33.8688, 0, 51, 80]) {
      for (const longitude of [-180, -75.1891, 0, 151.2093, 180]) {
        const angles = calculateAngles(utcInstant, latitude, longitude);
        assert.deepEqual(angles, calculateAnglesFromOrientation(angles.localSiderealDegrees, latitude, angles.trueObliquityDegrees));
        assert.ok(Object.isFrozen(angles));
        const asc = project(angles.ascendant, angles.localSiderealDegrees, latitude, angles.trueObliquityDegrees);
        assert.ok(Math.abs(asc.up) < 1e-12);
        for (const system of ['whole-sign', 'equal']) {
          const houses = calculateHouses({ utcInstant, latitude, longitude, system });
          assert.deepEqual(houses.angles, angles);
          const first = system === 'equal' ? angles.ascendant : Math.floor(angles.ascendant / 30) * 30;
          assert.equal(houses.cusps.length, 12);
          houses.cusps.forEach((cusp, index) => {
            assert.equal(cusp.house, index + 1);
            assert.ok(distance(cusp.longitude, wrap(first + index * 30)) < 1e-10);
          });
        }
      }
    }
  }
});

test('orientation inputs reject nonnumeric values, poles and degenerate obliquity', () => {
  for (const args of [[NaN, 51, 23.44], [75, Infinity, 23.44], [75, 51, '23.44'], [75, 90, 23.44], [75, -90, 23.44], [75, 51, 0], [75, 51, 90]]) {
    assert.throws(() => calculateAnglesFromOrientation(...args));
  }
  assert.deepEqual(calculateAnglesFromOrientation(-285, 51, 23.44), calculateAnglesFromOrientation(75, 51, 23.44));
  assert.throws(() => calculateAngles('2000-01-01T12:00:00Z', 90, 0), /undefined/);
});
