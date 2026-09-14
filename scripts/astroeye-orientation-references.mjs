import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { calculateAnglesFromOrientation } from '../src/modules/astroeye/calculation/houses.js';

const SOURCE = 'https://github.com/0xStarcat/CircularNatalHoroscopeJS';
const COMMIT = '76e150f64a3525797afe5b7ce118c2c63a1d59bd';
const INPUTS = [
  ['ascendant', 40.72, 25.96], ['ascendant', 42.37, 95.7499998542],
  ['ascendant', -33.47, 121.88288750336505], ['ascendant', 40.65871, 238.89506391854957],
  ...[0, 90, 179, 180, 181, 270, 359, 359.79954708891455, 14.8123734689, 269.524892875, 284.5659616273]
    .map((theta) => ['midheaven', 0, theta]),
];
const validAngle = (v) => Number.isFinite(v) && v >= 0 && v < 360;

export function readOrientationReferences() {
  return JSON.parse(readFileSync(new URL('../src/modules/astroeye/calculation/fixtures/published-orientation-angles.json', import.meta.url), 'utf8'));
}

export function compareOrientationReferences(pack = readOrientationReferences(), calculate = calculateAnglesFromOrientation) {
  const fail = () => { throw new Error('Unsupported orientation reference contract'); };
  const prefix = `${SOURCE}/blob/${COMMIT}/`;
  if (pack?.schemaVersion !== 1 || pack.source?.repository !== SOURCE || pack.source?.commit !== COMMIT
    || pack.source?.assertions !== prefix + 'tests/utilities.astronomy.test.js'
    || pack.source?.conventions !== prefix + 'src/utilities/astronomy.js'
    || pack.source?.license !== 'Unlicense' || pack.source?.licenseUrl !== prefix + 'LICENSE'
    || pack.source?.retrievedOn !== '2026-09-14' || pack.obliquityDegrees !== 23.4367
    || pack.toleranceArcseconds !== 0.36 || !Array.isArray(pack.cases) || pack.cases.length !== INPUTS.length) fail();
  const results = Array.from(pack.cases, (row, i) => {
    const [component, latitude, theta] = INPUTS[i];
    const id = i < 4 ? `asc-${i + 1}` : `mc-${i - 3}`;
    if (!row || row.id !== id || row.component !== component || row.latitude !== latitude
      || row.localSiderealDegrees !== theta || !validAngle(row.expected)) fail();
    // MC does not depend on latitude. Zero is solely a nonpolar adapter input,
    // not a published venue. These assertions do not establish a UTC timestamp.
    const actual = calculate(theta, latitude, pack.obliquityDegrees, { calculationVersion: 4 })?.[component];
    const errorArcseconds = validAngle(actual) ? Math.abs(((actual - row.expected + 540) % 360) - 180) * 3600 : null;
    return { id, component, errorArcseconds, passed: errorArcseconds !== null && errorArcseconds <= 0.36 };
  });
  return { scope: 'Orientation geometry only; A1 remains open.', calculationVersion: 4,
    results, passed: results.every((row) => row.passed) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = compareOrientationReferences();
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exitCode = 1;
}
