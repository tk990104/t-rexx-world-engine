import assert from 'node:assert/strict';
import test from 'node:test';
import {
  HORIZONS_TARGETS, POSITION_LIMIT_ARCSECONDS, MOTION_LIMIT_DEGREES_PER_DAY,
  compareReference, readReference, parseHorizonsResponse, signedDelta,
} from '../../../../scripts/astroeye-horizons.mjs';

for (const body of Object.keys(HORIZONS_TARGETS)) {
  test(`independent JPL Horizons positions and motion: ${body}`, () => {
    const fixture = readReference(body);
    assert.equal(fixture.response.signature.source, 'NASA/JPL Horizons API');
    // The collected responses report 1.2. Review upstream format changes before
    // adopting fixtures with another signature; the docs currently list 1.3.
    assert.equal(fixture.response.signature.version, '1.2');
    const { samples, motionSamples } = compareReference(body);
    for (const sample of samples) {
      assert.ok(sample.longitudeErrorArcseconds <= POSITION_LIMIT_ARCSECONDS,
        `${body} ${sample.instant}: longitude differs by ${sample.longitudeErrorArcseconds} arcseconds`);
      assert.ok(sample.latitudeErrorArcseconds <= POSITION_LIMIT_ARCSECONDS,
        `${body} ${sample.instant}: latitude differs by ${sample.latitudeErrorArcseconds} arcseconds`);
    }
    for (const sample of motionSamples) {
      assert.ok(sample.motionErrorDegreesPerDay <= MOTION_LIMIT_DEGREES_PER_DAY,
        `${body} ${sample.instant}: motion differs by ${sample.motionErrorDegreesPerDay} deg/day`);
      if (sample.directionIsDecisive) assert.ok(sample.directionMatches, 'retrograde direction must agree');
    }
  });
}

test('reference comparison takes the short path through the zodiac boundary', () => {
  assert.equal(signedDelta(359.9, 0.1).toFixed(3), '0.200');
  assert.equal(signedDelta(0.1, 359.9).toFixed(3), '-0.200');
});

test('reference parser rejects wrong observers, epochs, bodies, and missing data', () => {
  const { response } = readReference('Sun');
  const changed = (from, to) => ({ ...response, result: response.result.replace(from, to) });
  assert.throws(() => parseHorizonsResponse({ error: 'upstream unavailable' }, 'Sun'), /upstream unavailable/);
  assert.throws(() => parseHorizonsResponse(changed('Earth (399)', 'Mars (499)'), 'Sun'), /observer/);
  assert.throws(() => parseHorizonsResponse(response, 'Moon'), /target/);
  assert.throws(() => parseHorizonsResponse(changed('2451544.750000000', '2451544.850000000'), 'Sun'), /epoch/);
  assert.throws(() => parseHorizonsResponse(changed('280.1140539', 'n.a.'), 'Sun'), /coordinates/);
  assert.throws(() => parseHorizonsResponse(changed('$$EOE', 'END'), 'Sun'), /table/);
});
