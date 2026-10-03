import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import * as Astronomy from 'astronomy-engine';
import { parseSunReference } from './astroeye-sun-references.mjs';

export function readSunRecovery() {
  return JSON.parse(readFileSync(new URL('../src/modules/astroeye/calculation/fixtures/usno-sun-recovery.json', import.meta.url), 'utf8'));
}

/** Offline independent solar references. No retrieval during tests or startup. */
export function compareSunRecovery(pack = readSunRecovery()) {
  const fail = () => { throw new Error('Unsupported solar recovery reference contract'); };
  if (pack?.schemaVersion !== 1 || pack.source?.id !== 'usno-rstt-oneday'
    || pack.source?.retrievedOn !== '2026-10-03' || pack.toleranceSeconds !== 120
    || pack.boundaryProbeSeconds !== 240 || !Array.isArray(pack.cases) || pack.cases.length !== 2) fail();
  const expected = [['north-70-resumed-cycle', '2024-07-27'], ['north-70-next-cycle', '2024-07-28']];
  return pack.cases.map((row, index) => {
    if (row?.id !== expected[index][0] || row.date !== expected[index][1]
      || row.latitude !== 70 || row.longitude !== 0 || row.offsetHours !== 0 || row.timeZone !== 'UTC') fail();
    const reference = parseSunReference(row);
    if (reference.status !== 'rise-set') fail();
    const observer = new Astronomy.Observer(row.latitude, row.longitude, 0);
    const boundaries = {};
    for (const [kind, direction] of [['rise', 1], ['set', -1]]) {
      const actual = Astronomy.SearchRiseSet(Astronomy.Body.Sun, observer, direction, new Date(row.date + 'T00:00:00Z'), 1);
      const errorSeconds = actual ? Math.abs(actual.date.getTime() - Date.parse(reference[kind])) / 1000 : null;
      boundaries[kind] = { expected: reference[kind], actual: actual?.date.toISOString() ?? null,
        errorSeconds, passed: errorSeconds !== null && errorSeconds <= pack.toleranceSeconds };
    }
    return { id: row.id, boundaries, passed: Object.values(boundaries).every(value => value.passed) };
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const results = compareSunRecovery();
  console.log(JSON.stringify(results, null, 2));
  if (results.some(result => !result.passed)) process.exitCode = 1;
}
