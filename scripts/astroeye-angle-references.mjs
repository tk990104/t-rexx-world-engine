import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { calculateAngles, calculateAnglesFromOrientation, calculateHouses } from '../src/modules/astroeye/calculation/houses.js';

export function readAngleReferences() {
  return JSON.parse(readFileSync(new URL('../src/modules/astroeye/calculation/fixtures/published-chart-angles.json', import.meta.url), 'utf8'));
}

const validAngle = (value) => Number.isFinite(value) && value >= 0 && value < 360;
const arcseconds = (a, b) => Math.abs(((a - b + 540) % 360) - 180) * 3600;

export function compareAngleReferences(pack = readAngleReferences()) {
  if (pack?.schemaVersion !== 1 || pack.source?.commit !== '76e150f64a3525797afe5b7ce118c2c63a1d59bd'
    || pack.conventions?.referenceObliquityDegrees !== 23.4367
    || pack.conventions?.matchedOrientationToleranceArcseconds !== 0.36
    || pack.conventions?.dateComparisonToleranceArcseconds !== 60
    || !Array.isArray(pack.cases) || pack.cases.length !== 2) {
    throw new Error('Unsupported angle-reference provenance, conventions or sample count');
  }
  const ids = new Set();
  return pack.cases.map((entry) => {
    if (typeof entry.id !== 'string' || !entry.id || ids.has(entry.id)
      || typeof entry.utcInstant !== 'string' || !entry.utcInstant.endsWith('Z')
      || !Number.isFinite(Date.parse(entry.utcInstant))
      || !Number.isFinite(entry.latitude) || Math.abs(entry.latitude) >= 90
      || !Number.isFinite(entry.longitude) || Math.abs(entry.longitude) > 180
      || ![entry.referenceLocalSiderealDegrees, entry.ascendant, entry.midheaven].every(validAngle)) {
      throw new Error('Invalid angle-reference input or output');
    }
    ids.add(entry.id);
    if (entry.cusps !== null && (!entry.cusps || Object.keys(entry.cusps).sort().join(',') !== 'equal,whole-sign'
      || Object.values(entry.cusps).some((values) => !Array.isArray(values) || values.length !== 12 || !values.every(validAngle)))) {
      throw new Error('Invalid angle-reference cusps');
    }
    const matched = calculateAnglesFromOrientation(entry.referenceLocalSiderealDegrees, entry.latitude, pack.conventions.referenceObliquityDegrees);
    const dated = calculateAngles(entry.utcInstant, entry.latitude, entry.longitude);
    const matchedErrors = Object.fromEntries(['ascendant', 'midheaven'].map((key) => [key, arcseconds(matched[key], entry[key])]));
    const dateErrors = Object.fromEntries(['ascendant', 'midheaven'].map((key) => [key, arcseconds(dated[key], entry[key])]));
    const cuspErrors = entry.cusps === null ? null : Object.fromEntries(Object.entries(entry.cusps).map(([system, expected]) => {
      const actual = calculateHouses({ ...entry, system }).cusps;
      return [system, Math.max(...actual.map((cusp, i) => arcseconds(cusp.longitude, expected[i])))];
    }));
    return {
      id: entry.id,
      matchedOrientationErrorArcseconds: matchedErrors,
      dateBasedErrorArcseconds: dateErrors,
      maximumCuspErrorArcseconds: cuspErrors,
      passed: Object.values(matchedErrors).every((error) => error <= 0.36)
        && Object.values(dateErrors).every((error) => error <= 60)
        && (cuspErrors === null || (cuspErrors.equal <= 60 && cuspErrors['whole-sign'] === 0)),
    };
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = compareAngleReferences();
  console.log(JSON.stringify(result, null, 2));
  if (result.some(({ passed }) => !passed)) process.exitCode = 1;
}
