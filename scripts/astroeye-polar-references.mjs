import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { calculateAnglesFromOrientation } from '../src/modules/astroeye/calculation/houses.js';

export function readPolarBehaviorReference() {
  return JSON.parse(readFileSync(new URL('../src/modules/astroeye/calculation/fixtures/published-polar-behavior.json', import.meta.url), 'utf8'));
}
const separation = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
const signedChange = (a, b) => ((b - a + 540) % 360) - 180;
const valid = (v) => Number.isFinite(v) && v >= 0 && v < 360;

/** Published rounded behavior only. This is deliberately not a UTC/house oracle. */
export function comparePolarBehavior(pack = readPolarBehaviorReference(), calculate = calculateAnglesFromOrientation) {
  const p = pack?.published, c = pack?.testConventions;
  if (pack?.schemaVersion !== 1 || pack.id !== 'koch-astrodienst-78n-behavior'
    || pack.source?.url !== 'https://www.astro.com/astrology/in_polar_asc_e.htm'
    || pack.source?.author !== 'Dieter Koch' || pack.source?.retrievedOn !== '2026-09-13'
    || p?.latitude !== 78 || p.equinoctialHalfWidthDegrees !== 31
    || p.directCenterDegrees !== 180 || p.retrogradeCenterDegrees !== 0 || p.dailyHalfTurnJumps !== 2
    || c?.kind !== 'orientation-behavior-only' || c.adoptedObliquityDegrees !== 23.44
    || c.boundToleranceDegrees !== 1 || c.siderealStepDegrees !== 0.5
    || c.motionHalfStepDegrees !== 0.01 || c.jumpThresholdDegrees !== 170) {
    throw new Error('Unsupported polar-reference provenance, bounds or sampling conventions');
  }
  const at = (theta) => calculate(theta, p.latitude, c.adoptedObliquityDegrees).ascendant;
  const result = { scope: c.kind, samples: 0, rangeFailures: 0, motionFailures: 0,
    invalidSamples: 0, jumpSamplesSkippedForMotion: 0, observedJumps: 0,
    directSamples: 0, retrogradeSamples: 0, maximumExcursionDegrees: 0, passed: false };
  const angles = [];
  for (let theta = 0; theta < 360; theta += c.siderealStepDegrees) {
    const asc = at(theta), before = at(theta - c.motionHalfStepDegrees), after = at(theta + c.motionHalfStepDegrees);
    result.samples++;
    angles.push(asc);
    if (![asc, before, after].every(valid)) { result.invalidSamples++; continue; }
    const direct = separation(asc, p.directCenterDegrees) < 90;
    const excursion = separation(asc, direct ? p.directCenterDegrees : p.retrogradeCenterDegrees);
    result.maximumExcursionDegrees = Math.max(result.maximumExcursionDegrees, excursion);
    if (excursion > p.equinoctialHalfWidthDegrees + c.boundToleranceDegrees) result.rangeFailures++;
    const change = signedChange(before, after);
    if (Math.abs(change) > c.jumpThresholdDegrees) { result.jumpSamplesSkippedForMotion++; continue; }
    if (direct) result.directSamples++; else result.retrogradeSamples++;
    if (direct ? change <= 0 : change >= 0) result.motionFailures++;
  }
  angles.forEach((asc, i) => {
    const next = angles[(i + 1) % angles.length];
    if (valid(asc) && valid(next) && separation(asc, next) > c.jumpThresholdDegrees) result.observedJumps++;
  });
  result.passed = result.invalidSamples === 0 && result.rangeFailures === 0 && result.motionFailures === 0
    && result.directSamples > 0 && result.retrogradeSamples > 0 && result.observedJumps === p.dailyHalfTurnJumps
    && result.maximumExcursionDegrees >= p.equinoctialHalfWidthDegrees - c.boundToleranceDegrees;
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = comparePolarBehavior();
  console.log(JSON.stringify(result, null, 2));
  if (!result.passed) process.exitCode = 1;
}
