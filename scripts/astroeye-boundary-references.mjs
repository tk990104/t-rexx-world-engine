import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { horizonsUrl, parseHorizonsResponse, signedDelta, POSITION_LIMIT_ARCSECONDS, MOTION_LIMIT_DEGREES_PER_DAY } from './astroeye-horizons.mjs';
import { calculateUtcTtPositions } from '../src/modules/astroeye/calculation/utcTtPositions.js';

// Fixed before reference retrieval. A sparse first slice, not exact root timing.
export const BOUNDARY_CENTERS = Object.freeze({
  Sun: Object.freeze(['2024-03-19T12:00:00.000Z', '2024-03-20T03:00:00.000Z', '2024-03-20T12:00:00.000Z']),
  Mercury: Object.freeze(['2024-03-28T12:00:00.000Z', '2024-04-01T12:00:00.000Z', '2024-04-05T12:00:00.000Z',
    '2024-04-21T12:00:00.000Z', '2024-04-25T12:00:00.000Z', '2024-04-30T12:00:00.000Z']),
});
const shifted = (instant, hours) => new Date(Date.parse(instant) + hours * 3600000).toISOString();
export function boundarySamples(body) {
  if (!Object.hasOwn(BOUNDARY_CENTERS, body)) throw new Error('Unsupported boundary body');
  return [...new Set(BOUNDARY_CENTERS[body].flatMap((instant) => [-6, 0, 6].map((hours) => shifted(instant, hours))))].sort();
}
export function validateBoundaryReference(fixture, body) {
  const samples = boundarySamples(body);
  if (fixture?.body !== body || fixture.requestUrl !== horizonsUrl(body, samples)
    || typeof fixture.retrievedAt !== 'string' || !/^2026-09-13T/.test(fixture.retrievedAt)
    || !Number.isFinite(Date.parse(fixture.retrievedAt))
    || fixture.response?.signature?.version !== '1.2'
    || fixture.response?.signature?.source !== 'NASA/JPL Horizons API') throw new Error('Boundary provenance mismatch');
  const result = fixture.response.result;
  if (typeof result !== 'string' || !/Center-site name:\s*GEOCENTRIC/.test(result)
    || !/Atmos refraction:\s*NO \(AIRLESS\)/.test(result) || !/Date_________JDUT/.test(result)
    || !/^Target body name:[^\n]*\{source: DE441\}/m.test(result)
    || !/^Center body name:[^\n]*\{source: DE441\}/m.test(result)
    || !/^EOP file\s*:\s*eop\.260911\.p261208\s*$/m.test(result)) throw new Error('Boundary conventions mismatch');
  return parseHorizonsResponse(fixture.response, body, samples);
}
export function readBoundaryReference(body) {
  boundarySamples(body);
  const fixture = JSON.parse(readFileSync(new URL(`../src/modules/astroeye/calculation/fixtures/horizons-boundary/${body.toLowerCase()}.json`, import.meta.url), 'utf8'));
  return { ...fixture, rows: validateBoundaryReference(fixture, body) };
}
export function compareBoundaryReference(body, positionAt = (instant) => calculateUtcTtPositions(instant).positions.find((p) => p.body === body)) {
  const { rows } = readBoundaryReference(body);
  const samples = rows.map((row) => {
    const actual = positionAt(row.instant);
    const boundaryDistanceArcseconds = Math.min(row.longitude % 30, 30 - row.longitude % 30) * 3600;
    return { instant: row.instant, longitudeErrorArcseconds: Math.abs(signedDelta(row.longitude, actual.longitude)) * 3600,
      latitudeErrorArcseconds: Math.abs(row.latitude - actual.latitude) * 3600,
      boundaryDistanceArcseconds, signDecisive: boundaryDistanceArcseconds > POSITION_LIMIT_ARCSECONDS,
      signMatches: Math.floor(row.longitude / 30) === Math.floor(actual.longitude / 30) };
  });
  const motions = BOUNDARY_CENTERS[body].map((instant) => {
    const before = rows.find((row) => row.instant === shifted(instant, -6));
    const after = rows.find((row) => row.instant === shifted(instant, 6));
    const expected = signedDelta(before.longitude, after.longitude) * 2;
    const actual = positionAt(instant);
    return { instant, expected, errorDegreesPerDay: Math.abs(expected - actual.motionDegPerDay),
      decisive: Math.abs(expected) > MOTION_LIMIT_DEGREES_PER_DAY,
      directionMatches: (expected < 0) === actual.retrograde };
  });
  return { body, samples, motions, passed: samples.every((s) => s.longitudeErrorArcseconds <= POSITION_LIMIT_ARCSECONDS
    && s.latitudeErrorArcseconds <= POSITION_LIMIT_ARCSECONDS && (!s.signDecisive || s.signMatches))
    && motions.every((m) => m.errorDegreesPerDay <= MOTION_LIMIT_DEGREES_PER_DAY && (!m.decisive || m.directionMatches)) };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.length === 2) {
    const results = Object.keys(BOUNDARY_CENTERS).map((body) => compareBoundaryReference(body));
    console.log(JSON.stringify({ calculationVersion: 4, results }, null, 2));
    if (results.some((r) => !r.passed)) process.exitCode = 1;
  } else {
    const body = process.argv[3];
    if (process.argv.length !== 4 || process.argv[2] !== '--fetch') throw new Error('Usage: node scripts/astroeye-boundary-references.mjs [--fetch Sun|Mercury]');
    const requestUrl = horizonsUrl(body, boundarySamples(body));
    const response = await fetch(requestUrl, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`Horizons HTTP ${response.status}; stop without retry`);
    const fixture = { body, retrievedAt: new Date().toISOString(), requestUrl, response: await response.json() };
    validateBoundaryReference(fixture, body);
    console.log(JSON.stringify(fixture, null, 2));
  }
}
