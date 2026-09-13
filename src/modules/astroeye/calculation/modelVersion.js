import { ASTRONOMY_ENGINE_SOURCE } from './astronomyEngineProvider.js';

// Version 1 retains the existing math, including its documented polar limitations.
export const ASTROEYE_CALCULATION_VERSION = 1;

/** Only omission denotes legacy v1. Explicit null, strings and invalid numbers do not. */
export function chartCalculationVersion(chart) {
  const value = chart?.calculationVersion;
  if (value === undefined) return 1;
  if (!Number.isSafeInteger(value) || value < 1) throw new RangeError('Invalid AstroEye calculation version.');
  return value;
}

export function requireCalculationVersion(version) {
  if (version !== ASTROEYE_CALCULATION_VERSION) throw new RangeError('Unsupported AstroEye calculation version.');
  return version;
}

export function isSupportedChartCalculation(chart) {
  try {
    return chartCalculationVersion(chart) === ASTROEYE_CALCULATION_VERSION
      && chart?.engine?.id === ASTRONOMY_ENGINE_SOURCE.id
      && chart?.engine?.version === ASTRONOMY_ENGINE_SOURCE.version
      && chart?.options?.zodiac === 'tropical'
      && chart?.options?.referenceFrame === 'apparent-geocentric-true-ecliptic-of-date';
  } catch { return false; }
}

export function requireSupportedChartCalculation(chart) {
  if (!isSupportedChartCalculation(chart)) {
    throw new Error('Saved chart calculation model or engine is unsupported. Records were left unchanged.');
  }
  return chartCalculationVersion(chart);
}
