import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import * as Astronomy from 'astronomy-engine';
import { horizonsUrl, parseHorizonsResponse, signedDelta, POSITION_LIMIT_ARCSECONDS, MOTION_LIMIT_DEGREES_PER_DAY } from './astroeye-horizons.mjs';
import { calculateAstronomyEnginePositions } from '../src/modules/astroeye/calculation/astronomyEngineProvider.js';

export const RANGE_BODIES = Object.freeze(['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto']);
// Reviewed September 13 snapshot headers; merged planet-center sources differ.
export const RANGE_REFERENCE_SOURCES = Object.freeze(Object.fromEntries([
  ['Sun', 'DE441'], ['Moon', 'DE441'], ['Mercury', 'DE441'], ['Venus', 'DE441'],
  ['Mars', 'mar099'], ['Jupiter', 'jup365_merged'], ['Saturn', 'sat441l'],
  ['Uranus', 'ura184_merged'], ['Neptune', 'nep098_merged'], ['Pluto', 'plu060_merged'],
].map(([body, target]) => [body, Object.freeze({ target, center: body === 'Neptune' ? target : 'DE441' })])));
export const RANGE_CENTERS = Object.freeze(['1900-01-01T12:00:00.000Z', '1950-06-21T12:00:00.000Z', '2100-12-31T12:00:00.000Z']);
export const RANGE_SAMPLES = Object.freeze(RANGE_CENTERS.flatMap((instant) => [-6, 0, 6].map((hours) => new Date(Date.parse(instant) + hours * 3600000).toISOString())));
export function validateRangeReference(fixture, body) {
  if (!RANGE_BODIES.includes(body) || fixture?.body !== body || fixture.requestUrl !== horizonsUrl(body, RANGE_SAMPLES)
    || typeof fixture.retrievedAt !== 'string' || !/^2026-09-13T/.test(fixture.retrievedAt)
    || !Number.isFinite(Date.parse(fixture.retrievedAt))
    || fixture.response?.signature?.version !== '1.2'
    || fixture.response?.signature?.source !== 'NASA/JPL Horizons API') throw new Error('Range reference provenance mismatch');
  if (!/Center-site name:\s*GEOCENTRIC/.test(fixture.response.result)
    || !/Atmos refraction:\s*NO \(AIRLESS\)/.test(fixture.response.result)
    || !/Date_________JDUT/.test(fixture.response.result)) throw new Error('Range reference conventions mismatch');
  const source = RANGE_REFERENCE_SOURCES[body];
  const headerSource = (label) => fixture.response.result.split('\n')
    .find((line) => line.startsWith(label))?.match(/\{source: ([^}]+)\}/)?.[1];
  if (headerSource('Target body name:') !== source.target
    || headerSource('Center body name:') !== source.center
    || !/^EOP file\s*:\s*eop\.260911\.p261208\s*$/m.test(fixture.response.result)) {
    throw new Error('Range reference source snapshot mismatch');
  }
  return parseHorizonsResponse(fixture.response, body, RANGE_SAMPLES);
}
export function readRangeReference(body) {
  if (!RANGE_BODIES.includes(body)) throw new Error('Unsupported range reference body');
  const fixture = JSON.parse(readFileSync(new URL(`../src/modules/astroeye/calculation/fixtures/horizons-range/${body.toLowerCase()}.json`, import.meta.url), 'utf8'));
  return { ...fixture, rows: validateRangeReference(fixture, body) };
}
export function compareRangeReference(body) {
  const { rows } = readRangeReference(body);
  const samples = rows.map((row) => {
    const actual = calculateAstronomyEnginePositions(row.instant).find((p) => p.body === body);
    return { instant: row.instant, longitudeErrorArcseconds: Math.abs(signedDelta(row.longitude, actual.longitude)) * 3600,
      latitudeErrorArcseconds: Math.abs(row.latitude - actual.latitude) * 3600 };
  });
  const motions = RANGE_CENTERS.map((instant, index) => {
    const expected = signedDelta(rows[index * 3].longitude, rows[index * 3 + 2].longitude) * 2;
    const actual = calculateAstronomyEnginePositions(instant).find((p) => p.body === body);
    return { instant, expected, errorDegreesPerDay: Math.abs(expected - actual.motionDegPerDay),
      directionMatches: (expected < 0) === actual.retrograde, decisive: Math.abs(expected) > MOTION_LIMIT_DEGREES_PER_DAY };
  });
  return { body, samples, motions, passed: samples.every((s) => s.longitudeErrorArcseconds <= POSITION_LIMIT_ARCSECONDS && s.latitudeErrorArcseconds <= POSITION_LIMIT_ARCSECONDS)
    && motions.every((m) => m.errorDegreesPerDay <= MOTION_LIMIT_DEGREES_PER_DAY && (!m.decisive || m.directionMatches)) };
}

// Diagnostic only: the bundled JPL helper is an approximation, not a retrieved
// TDB-UT measurement. Never change the library's global DeltaT function or use
// these adjusted times to replace application chart results or reference epochs.
export function compareMoonTimeConventions() {
  return readRangeReference('Moon').rows.slice(6).map((row) => {
    const time = new Astronomy.AstroTime(new Date(row.instant));
    const helperDeltaTSeconds = Astronomy.DeltaT_JplHorizons(time.ut);
    const diagnosticTime = Astronomy.AstroTime.FromTerrestrialTime(time.ut + helperDeltaTSeconds / 86400);
    const diagnostic = Astronomy.EclipticGeoMoon(diagnosticTime);
    return { instant: row.instant, defaultDeltaTSeconds: (time.tt - time.ut) * 86400,
      helperDeltaTSeconds, diagnosticLongitudeErrorArcseconds: Math.abs(signedDelta(row.longitude, diagnostic.lon)) * 3600 };
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.argv[2]) {
    const results = RANGE_BODIES.map(compareRangeReference);
    console.log(JSON.stringify({ legacyCalculationModels: [1, 2, 3], results, moonTimeConventionDiagnostic: compareMoonTimeConventions() }, null, 2));
    if (results.some((r) => !r.passed)) process.exitCode = 1;
  } else {
    const body = process.argv[3];
    if (process.argv[2] !== '--fetch' || !RANGE_BODIES.includes(body)) throw new Error(`Usage: node scripts/astroeye-range-references.mjs [--fetch ${RANGE_BODIES.join('|')}]`);
    const requestUrl = horizonsUrl(body, RANGE_SAMPLES);
    const response = await fetch(requestUrl, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`Horizons HTTP ${response.status}; stop without retry`);
    const fixture = { body, retrievedAt: new Date().toISOString(), requestUrl, response: await response.json() };
    validateRangeReference(fixture, body);
    console.log(JSON.stringify(fixture, null, 2));
  }
}
