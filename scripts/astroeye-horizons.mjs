import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { calculateAstronomyEnginePositions } from '../src/modules/astroeye/calculation/astronomyEngineProvider.js';

export const HORIZONS_TARGETS = Object.freeze({
  Sun: '10', Moon: '301', Mercury: '199', Venus: '299', Mars: '499',
  Jupiter: '599', Saturn: '699', Uranus: '799', Neptune: '899', Pluto: '999',
});
export const REFERENCE_INSTANTS = Object.freeze([
  '2000-01-01T12:00:00.000Z',
  '2024-04-08T18:00:00.000Z',
  '2026-09-11T00:15:00.000Z',
  '2028-02-29T12:00:00.000Z',
  '2030-06-21T00:00:00.000Z',
]);
export const SAMPLE_INSTANTS = Object.freeze(REFERENCE_INSTANTS.flatMap((instant) =>
  [-6, 0, 6].map((hours) => new Date(Date.parse(instant) + hours * 3600000).toISOString())));

export function horizonsUrl(body) {
  if (!Object.hasOwn(HORIZONS_TARGETS, body)) throw new RangeError('Unknown reference body');
  const quote = (value) => `'${value}'`;
  const parameters = {
    format: 'json', COMMAND: quote(HORIZONS_TARGETS[body]),
    OBJ_DATA: quote('NO'), MAKE_EPHEM: quote('YES'), EPHEM_TYPE: quote('OBSERVER'),
    CENTER: quote('500@399'), QUANTITIES: quote('31'),
    TIME_TYPE: quote('UT'), TLIST_TYPE: quote('JD'),
    TLIST: SAMPLE_INSTANTS.map((instant) => quote(Date.parse(instant) / 86400000 + 2440587.5)).join(' '),
    CAL_FORMAT: quote('JD'), TIME_DIGITS: quote('FRACSEC'),
    CSV_FORMAT: quote('YES'), EXTRA_PREC: quote('YES'), APPARENT: quote('AIRLESS'),
  };
  return `https://ssd.jpl.nasa.gov/api/horizons.api?${new URLSearchParams(parameters)}`;
}

/** Parse quantity 31 only; reject API errors, missing rows, or changed columns. */
export function parseHorizonsResponse(response, body) {
  if (!Object.hasOwn(HORIZONS_TARGETS, body)) throw new RangeError('Unknown reference body');
  if (response.error) throw new Error(`Horizons: ${response.error}`);
  if (!response.signature?.version || typeof response.result !== 'string') {
    throw new TypeError('Horizons response lacks signature or result');
  }
  const result = response.result;
  const targetLine = result.split(/\r?\n/).find((line) => line.startsWith('Target body name:'));
  if (!targetLine?.includes(`(${HORIZONS_TARGETS[body]})`) || !/Center body name:\s*Earth \(399\)/.test(result)) {
    throw new Error('Unexpected Horizons target or observer');
  }
  const lines = result.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === '$$SOE');
  const end = lines.findIndex((line) => line.trim() === '$$EOE');
  const header = lines.slice(0, start).findLast((line) => line.includes('ObsEcLon'));
  if (start < 0 || end <= start || !header) throw new Error('Horizons table missing');
  const columns = header.split(',').map((column) => column.trim());
  const lonIndex = columns.indexOf('ObsEcLon');
  const latIndex = columns.indexOf('ObsEcLat');
  if (lonIndex < 1 || latIndex < 1) throw new Error('Horizons quantity 31 columns missing');
  const rows = lines.slice(start + 1, end).filter((line) => line.trim()).map((line) => {
    const cells = line.split(',').map((cell) => cell.trim());
    const jd = Number(cells[0]);
    const longitude = cells[lonIndex] ? Number(cells[lonIndex]) : NaN;
    const latitude = cells[latIndex] ? Number(cells[latIndex]) : NaN;
    if (![jd, longitude, latitude].every(Number.isFinite)
      || longitude < 0 || longitude >= 360 || Math.abs(latitude) > 90) {
      throw new Error('Invalid Horizons coordinates');
    }
    return { jd, longitude, latitude };
  });
  if (rows.length !== SAMPLE_INSTANTS.length) throw new Error('Horizons sample count mismatch');
  return rows.map((row, index) => {
    const instant = SAMPLE_INSTANTS[index];
    const expectedJd = Date.parse(instant) / 86400000 + 2440587.5;
    if (Math.abs(row.jd - expectedJd) > 1e-7) throw new Error('Horizons epoch mismatch');
    return { instant, ...row };
  });
}

export function readReference(body) {
  if (!Object.hasOwn(HORIZONS_TARGETS, body)) throw new RangeError('Unknown reference body');
  const fixture = JSON.parse(readFileSync(new URL(`../src/modules/astroeye/calculation/fixtures/horizons/${body.toLowerCase()}.json`, import.meta.url), 'utf8'));
  if (fixture.body !== body || fixture.requestUrl !== horizonsUrl(body)) throw new Error('Reference query mismatch');
  return { ...fixture, rows: parseHorizonsResponse(fixture.response, body) };
}

export const POSITION_LIMIT_ARCSECONDS = 60;
// Two endpoint errors of <= 1 arcminute over a half-day imply <= 0.0667
// deg/day uncertainty in the reference finite difference. Round up explicitly.
export const MOTION_LIMIT_DEGREES_PER_DAY = 0.07;
export const signedDelta = (from, to) => ((to - from + 540) % 360) - 180;

export function compareReference(body) {
  const fixture = readReference(body);
  const samples = fixture.rows.map((row) => {
    const actual = calculateAstronomyEnginePositions(row.instant).find((position) => position.body === body);
    return {
      instant: row.instant,
      longitudeErrorArcseconds: Math.abs(signedDelta(row.longitude, actual.longitude)) * 3600,
      latitudeErrorArcseconds: Math.abs(actual.latitude - row.latitude) * 3600,
    };
  });
  const motionSamples = REFERENCE_INSTANTS.map((instant, index) => {
    const before = fixture.rows[index * 3];
    const after = fixture.rows[index * 3 + 2];
    const expectedMotion = signedDelta(before.longitude, after.longitude) * 2;
    const actual = calculateAstronomyEnginePositions(instant).find((position) => position.body === body);
    return {
      instant,
      expectedMotion,
      motionErrorDegreesPerDay: Math.abs(actual.motionDegPerDay - expectedMotion),
      directionMatches: actual.retrograde === (expectedMotion < 0),
      directionIsDecisive: Math.abs(expectedMotion) > MOTION_LIMIT_DEGREES_PER_DAY,
    };
  });
  return { body, samples, motionSamples };
}

// Manual reference collection only. One body per invocation; no retries and no
// browser embedding. Save reviewed stdout with the repository editing workflow.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.argv[2]) {
    const results = Object.keys(HORIZONS_TARGETS).map(compareReference);
    const summary = results.map(({ body, samples, motionSamples }) => ({
      body,
      maxLongitudeErrorArcseconds: Math.max(...samples.map((sample) => sample.longitudeErrorArcseconds)),
      maxLatitudeErrorArcseconds: Math.max(...samples.map((sample) => sample.latitudeErrorArcseconds)),
      maxMotionErrorDegreesPerDay: Math.max(...motionSamples.map((sample) => sample.motionErrorDegreesPerDay)),
      passed: samples.every((sample) => sample.longitudeErrorArcseconds <= POSITION_LIMIT_ARCSECONDS
        && sample.latitudeErrorArcseconds <= POSITION_LIMIT_ARCSECONDS)
        && motionSamples.every((sample) => sample.motionErrorDegreesPerDay <= MOTION_LIMIT_DEGREES_PER_DAY
          && (!sample.directionIsDecisive || sample.directionMatches)),
    }));
    console.log(JSON.stringify(summary, null, 2));
    if (summary.some((result) => !result.passed)) process.exitCode = 1;
  } else {
    if (process.argv[2] !== '--fetch' || !Object.hasOwn(HORIZONS_TARGETS, process.argv[3])) {
      throw new Error('Usage: node scripts/astroeye-horizons.mjs [--fetch Sun]');
    }
    const body = process.argv[3];
    const requestUrl = horizonsUrl(body);
    const response = await fetch(requestUrl, { signal: AbortSignal.timeout(45000) });
    if (!response.ok) throw new Error(`Horizons HTTP ${response.status}; stop and retry later`);
    const payload = await response.json();
    parseHorizonsResponse(payload, body);
    console.log(JSON.stringify({ body, retrievedAt: new Date().toISOString(), requestUrl, response: payload }, null, 2));
  }
}
