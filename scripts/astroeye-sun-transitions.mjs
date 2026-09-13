import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import * as Astronomy from 'astronomy-engine';
import { parseSunReference } from './astroeye-sun-references.mjs';

export function readSunTransitions() {
  return JSON.parse(readFileSync(new URL('../src/modules/astroeye/calculation/fixtures/usno-sun-transitions.json', import.meta.url), 'utf8'));
}

const EXPECTED = {
  'north-70-last-pair': ['2024-05-15', 'rise-set'],
  'north-70-last-rise': ['2024-05-16', 'rise-only'],
  'north-70-continuous-day': ['2024-05-17', 'polar-day'],
  'north-70-first-set': ['2024-07-26', 'set-only'],
};

export function compareSunTransitions(pack = readSunTransitions()) {
  const fail = () => { throw new Error('Unsupported solar transition reference contract'); };
  if (pack?.schemaVersion !== 1 || pack.source?.id !== 'usno-rstt-oneday'
    || pack.source?.retrievedOn !== '2026-09-13' || pack.toleranceSeconds !== 120
    || pack.boundaryProbeSeconds !== 240 || !Array.isArray(pack.cases) || pack.cases.length !== 4
    || new Set(pack.cases.map((r) => r.id)).size !== 4) fail();
  return pack.cases.map((row) => {
    const expected = EXPECTED[row.id];
    if (!expected || row.date !== expected[0] || row.expectedStatus !== expected[1]
      || row.latitude !== 70 || row.longitude !== 0 || row.offsetHours !== 0 || row.timeZone !== 'UTC') fail();
    const reference = parseSunReference(row, { allowPartial: true });
    if (reference.status !== expected[1]) fail();
    const observer = new Astronomy.Observer(row.latitude, row.longitude, 0);
    const boundaries = {};
    for (const [kind, direction] of [['rise', 1], ['set', -1]]) {
      // Search the whole fixed source day: a missing boundary is explicitly tested,
      // never accepted merely because no numeric comparison was possible.
      const actual = Astronomy.SearchRiseSet(Astronomy.Body.Sun, observer, direction, new Date(row.date + 'T00:00:00Z'), 1);
      const expectedTime = reference[kind];
      const errorSeconds = actual && expectedTime ? Math.abs(actual.date.getTime() - Date.parse(expectedTime)) / 1000 : null;
      boundaries[kind] = { expected: expectedTime ?? null, actual: actual?.date.toISOString() ?? null,
        errorSeconds, passed: expectedTime ? errorSeconds !== null && errorSeconds <= pack.toleranceSeconds : actual === null };
    }
    return { id: row.id, status: reference.status, boundaries, passed: Object.values(boundaries).every((r) => r.passed) };
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const results = compareSunTransitions();
  console.log(JSON.stringify(results, null, 2));
  if (results.some((r) => !r.passed)) process.exitCode = 1;
}
