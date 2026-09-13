import assert from 'node:assert/strict';
import test from 'node:test';

import { calculateAstroEyeChart, serializeAstroEyeChart } from './chart.js';
import {
  ASTROEYE_REGRESSION_CASES,
  chartRegressionFingerprint,
  eventFromRegressionCase,
} from './regressionCases.js';

test('regression pack covers twenty diverse event contexts', () => {
  assert.equal(ASTROEYE_REGRESSION_CASES.length, 20);
  assert.ok(new Set(ASTROEYE_REGRESSION_CASES.map(({ timeZone }) => timeZone)).size >= 15);
  assert.ok(ASTROEYE_REGRESSION_CASES.some(({ utcStart }) => utcStart));
});

for (const regressionCase of ASTROEYE_REGRESSION_CASES) {
  test(`legacy model 1 calculation regression: ${regressionCase.id}`, () => {
    assert.ok(regressionCase.expected, 'fixture must pin an expected fingerprint');
    const event = eventFromRegressionCase(regressionCase);
    const first = calculateAstroEyeChart(event, { calculationVersion: 1 });
    const second = calculateAstroEyeChart(event, { calculationVersion: 1 });

    assert.equal(serializeAstroEyeChart(first), serializeAstroEyeChart(second));
    assert.deepEqual(chartRegressionFingerprint(first), regressionCase.expected);
  });
  test(`model 2 calculation regression: ${regressionCase.id}`, () => {
    const event = eventFromRegressionCase(regressionCase);
    const first = calculateAstroEyeChart(event), second = calculateAstroEyeChart(event);
    assert.equal(serializeAstroEyeChart(first), serializeAstroEyeChart(second));
    // This internal pack's sole western branch is retained above as a v1 snapshot.
    // This is a regression expectation, not an external accuracy reference.
    const expected = { ...regressionCase.expected };
    if (regressionCase.id === 'longyearbyen-polar-night') expected.ascendant = 335.442571;
    assert.deepEqual(chartRegressionFingerprint(first), expected);
    const { ascendant, localSiderealDegrees, trueObliquityDegrees } = first.houses.angles;
    const rad = (v) => v * Math.PI / 180;
    const east = -Math.cos(rad(ascendant)) * Math.sin(rad(localSiderealDegrees))
      + Math.sin(rad(ascendant)) * Math.cos(rad(trueObliquityDegrees)) * Math.cos(rad(localSiderealDegrees));
    assert.ok(east > 0);
  });
}
