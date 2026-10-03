import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import * as Astronomy from 'astronomy-engine';
import { parseSunReference } from './astroeye-sun-references.mjs';

export function readPolarNightReferences() {
  return JSON.parse(readFileSync(new URL('../src/modules/astroeye/calculation/fixtures/usno-polar-night.json', import.meta.url), 'utf8'));
}

export function comparePolarNightReferences(pack = readPolarNightReferences()) {
  const fail = () => { throw new Error('Unsupported polar-night reference contract'); };
  const expected = [
    ['north-night-last-cycle', '2024-11-23', 'rise-set'], ['north-night-last-rise', '2024-11-24', 'rise-set'],
    ['north-night-absent-start', '2024-11-25', 'polar-night'], ['north-night-absent-end', '2025-01-15', 'polar-night'],
    ['north-night-first-cycle', '2025-01-16', 'rise-set'], ['north-night-next-rise', '2025-01-17', 'rise-set'],
  ];
  if (pack?.schemaVersion !== 1 || pack.source?.id !== 'usno-rstt-oneday' || pack.source?.retrievedOn !== '2026-10-03'
    || pack.toleranceSeconds !== 120 || pack.boundaryProbeSeconds !== 240
    || !Array.isArray(pack.cases) || pack.cases.length !== expected.length) fail();
  return pack.cases.map((row, index) => {
    const [id, date, status] = expected[index];
    if (row?.id !== id || row.date !== date || row.expectedStatus !== status
      || row.latitude !== 70 || row.longitude !== 0 || row.offsetHours !== 0 || row.timeZone !== 'UTC') fail();
    const reference = parseSunReference(row);
    if (reference.status !== status) fail();
    const observer = new Astronomy.Observer(row.latitude, row.longitude, 0), boundaries = {};
    for (const [kind, direction] of [['rise', 1], ['set', -1]]) {
      const actual = Astronomy.SearchRiseSet(Astronomy.Body.Sun, observer, direction, new Date(date + 'T00:00:00Z'), 1);
      const source = reference[kind] ?? null;
      const errorSeconds = actual && source ? Math.abs(actual.date.getTime() - Date.parse(source)) / 1000 : null;
      boundaries[kind] = { expected: source, actual: actual?.date.toISOString() ?? null, errorSeconds,
        passed: source ? errorSeconds !== null && errorSeconds <= pack.toleranceSeconds : actual === null };
    }
    return { id, status, boundaries, passed: Object.values(boundaries).every(value => value.passed) };
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const results = comparePolarNightReferences();
  console.log(JSON.stringify(results, null, 2));
  if (results.some(result => !result.passed)) process.exitCode = 1;
}
