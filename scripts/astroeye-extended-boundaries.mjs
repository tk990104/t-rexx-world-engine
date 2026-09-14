import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { horizonsUrl } from './astroeye-horizons.mjs';
import { validateBoundarySnapshot, compareBoundaryRows } from './astroeye-boundary-references.mjs';

// Fixed before retrieval. Local daily scanning selected station windows only;
// the independent reference supplies all expected coordinates and motion.
export const EXTENDED_CENTERS = Object.freeze({
  Sun: Object.freeze(['1900-03-20T12:00:00.000Z', '1900-03-22T12:00:00.000Z',
    '2100-03-19T12:00:00.000Z', '2100-03-21T12:00:00.000Z']),
  Mercury: Object.freeze(['1900-03-11T12:00:00.000Z', '1900-03-15T12:00:00.000Z', '1900-03-20T12:00:00.000Z',
    '2025-03-28T12:00:00.000Z', '2025-03-31T12:00:00.000Z',
    '2100-01-25T12:00:00.000Z', '2100-01-30T12:00:00.000Z', '2100-02-04T12:00:00.000Z']),
});
export function extendedSamples(body) {
  if (!Object.hasOwn(EXTENDED_CENTERS, body)) throw new Error('Unsupported extended boundary body');
  return EXTENDED_CENTERS[body].flatMap((instant) => [-6, 0, 6].map((hours) => new Date(Date.parse(instant) + hours * 3600000).toISOString()));
}
export function validateExtendedReference(fixture, body) {
  return validateBoundarySnapshot(fixture, body, extendedSamples(body), '2026-09-14');
}
export function readExtendedReference(body) {
  extendedSamples(body);
  const fixture = JSON.parse(readFileSync(new URL(`../src/modules/astroeye/calculation/fixtures/horizons-extended-boundary/${body.toLowerCase()}.json`, import.meta.url), 'utf8'));
  return { ...fixture, rows: validateExtendedReference(fixture, body) };
}
export function compareExtendedReference(body, positionAt) {
  return compareBoundaryRows(body, readExtendedReference(body).rows, EXTENDED_CENTERS[body], positionAt);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.length === 2) {
    const results = Object.keys(EXTENDED_CENTERS).map((body) => compareExtendedReference(body));
    console.log(JSON.stringify({ calculationVersion: 4, results }, null, 2));
    if (results.some((r) => !r.passed)) process.exitCode = 1;
  } else {
    const body = process.argv[3];
    if (process.argv.length !== 4 || process.argv[2] !== '--fetch') throw new Error('Usage: node scripts/astroeye-extended-boundaries.mjs [--fetch Sun|Mercury]');
    const requestUrl = horizonsUrl(body, extendedSamples(body));
    const response = await fetch(requestUrl, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`Horizons HTTP ${response.status}; stop without retry`);
    const fixture = { body, retrievedAt: new Date().toISOString(), requestUrl, response: await response.json() };
    validateExtendedReference(fixture, body);
    console.log(JSON.stringify(fixture, null, 2));
  }
}
