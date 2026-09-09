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
  test(`calculation regression: ${regressionCase.id}`, () => {
    assert.ok(regressionCase.expected, 'fixture must pin an expected fingerprint');
    const event = eventFromRegressionCase(regressionCase);
    const first = calculateAstroEyeChart(event);
    const second = calculateAstroEyeChart(event);

    assert.equal(serializeAstroEyeChart(first), serializeAstroEyeChart(second));
    assert.deepEqual(chartRegressionFingerprint(first), regressionCase.expected);
  });
}
