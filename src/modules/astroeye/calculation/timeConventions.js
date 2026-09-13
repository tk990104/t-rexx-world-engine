import { ephemerisTimeInfo, EPHEMERIS_TIME_POLICY } from './ephemerisTime.js';

export const INHERITED_TIME_POLICY = 'model-3-astronomy-engine-default';
export function model4TimeConventions(instant) {
  return Object.freeze({ positions: ephemerisTimeInfo(instant),
    angles: INHERITED_TIME_POLICY, planetaryHours: INHERITED_TIME_POLICY, skyRotation: INHERITED_TIME_POLICY });
}
export function hasModel4TimeConventions(chart) {
  try {
    const actual = chart?.timeConventions, expected = model4TimeConventions(chart?.calculatedFor);
    return actual?.angles === expected.angles && actual?.planetaryHours === expected.planetaryHours
      && actual?.skyRotation === expected.skyRotation
      && Object.entries(expected.positions).every(([key, value]) => actual?.positions?.[key] === value);
  } catch { return false; }
}
export function chartTimePolicyNote(chart) {
  if (chart?.calculationVersion !== 4) return '';
  if (!hasModel4TimeConventions(chart)) return 'Time-policy metadata is invalid; this chart is unavailable for recalculation or comparison.';
  const { basis, ttMinusInputSeconds } = chart.timeConventions.positions;
  const detail = basis === 'historical-ut1-estimate'
    ? 'Before 1962, civil time is treated as an estimated UT1 input; historical timing is approximate.'
    : basis === 'future-held-leap-seconds'
      ? 'Future leap seconds are unknown; the September 2026 offset is held constant. Future timing is provisional.'
      : 'Published historical UTC offsets are used.';
  return `Positions: UTC/TT policy ${EPHEMERIS_TIME_POLICY.id}; TT offset ${ttMinusInputSeconds.toFixed(6)} seconds. ${detail} Angles, sky rotation and planetary hours retain model 3 time approximations; they are not newly precision-certified.`;
}
