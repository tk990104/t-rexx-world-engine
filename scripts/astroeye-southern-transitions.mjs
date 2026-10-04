import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import * as Astronomy from 'astronomy-engine';
import { parseSunReference } from './astroeye-sun-references.mjs';

export function readSouthernTransitions() {
  return JSON.parse(readFileSync(new URL('../src/modules/astroeye/calculation/fixtures/usno-southern-transitions.json', import.meta.url), 'utf8'));
}

export function compareSouthernTransitions(pack = readSouthernTransitions()) {
  const fail = () => { throw new Error('Unsupported southern solar reference contract'); };
  const expected = [
    ['2024-01-24', 'polar-day'], ['2024-01-25', 'multiple-boundaries'], ['2024-01-26', 'rise-set'],
    ['2024-05-22', 'rise-set'], ['2024-05-23', 'rise-set'], ['2024-05-24', 'polar-night'],
    ['2024-07-18', 'polar-night'], ['2024-07-19', 'rise-set'], ['2024-07-20', 'rise-set'],
    ['2024-11-16', 'rise-set'], ['2024-11-17', 'rise-only'], ['2024-11-18', 'polar-day'],
  ];
  if (pack?.schemaVersion !== 1 || pack.source?.id !== 'usno-rstt-oneday' || pack.source?.retrievedOn !== '2026-10-04'
    || pack.toleranceSeconds !== 120 || pack.boundaryProbeSeconds !== 240
    || !Array.isArray(pack.cases) || pack.cases.length !== expected.length) fail();
  return pack.cases.map((row, index) => {
    const [date, status] = expected[index];
    if (row?.id !== `south-${date}` || row.date !== date || row.expectedStatus !== status
      || row.latitude !== -70 || row.longitude !== 0 || row.offsetHours !== 0 || row.timeZone !== 'UTC') fail();
    if (status === 'multiple-boundaries') {
      // Preserve both sets. Validate metadata and each timestamp individually,
      // without silently simplifying this day into an ordinary rise/set pair.
      const solar = row.response?.properties?.data?.sundata;
      if (!Array.isArray(solar) || solar.some(entry => !entry || typeof entry.phen !== 'string')) fail();
      const events = solar.filter(entry => ['Rise', 'Set'].includes(entry.phen));
      if (events.length !== 3 || events.map(entry => entry.phen).join(',') !== 'Set,Rise,Set'
        || solar.some(entry => /Horizon/.test(entry.phen))) fail();
      const instants = events.map(entry => {
        const isolated = structuredClone(row);
        isolated.response.properties.data.sundata = [entry];
        const parsed = parseSunReference(isolated, { allowPartial: true });
        return parsed.rise ?? parsed.set;
      });
      if (!(instants[0] < instants[1] && instants[1] < instants[2]) || events[0].time !== '00:00') fail();
      return { id: row.id, status, passed: null, outcome: 'unsupported-shape',
        reason: 'Two sunsets in one reference day. Ordinary comparison is intentionally not attempted.', sourceInstants: instants };
    }
    const reference = parseSunReference(row, { allowPartial: true });
    if (reference.status !== status) fail();
    const observer = new Astronomy.Observer(row.latitude, row.longitude, 0), boundaries = {};
    for (const [kind, direction] of [['rise', 1], ['set', -1]]) {
      const actual = Astronomy.SearchRiseSet(Astronomy.Body.Sun, observer, direction, new Date(date + 'T00:00:00Z'), 1);
      const source = reference[kind] ?? null;
      const errorSeconds = actual && source ? Math.abs(actual.date.getTime() - Date.parse(source)) / 1000 : null;
      boundaries[kind] = { expected: source, actual: actual?.date.toISOString() ?? null, errorSeconds,
        passed: source ? errorSeconds !== null && errorSeconds <= pack.toleranceSeconds : actual === null };
    }
    const passed = Object.values(boundaries).every(value => value.passed);
    return { id: row.id, status, boundaries, passed, outcome: passed ? 'matched' : 'discrepancy' };
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const results = compareSouthernTransitions();
  console.log(JSON.stringify({ passed: results.every(row => row.passed === true),
    matchedCases: results.filter(row => row.passed === true).length,
    unresolvedCases: results.filter(row => row.passed !== true).map(row => row.id), results }, null, 2));
  // A known discrepancy is still not release acceptance. Never exit green merely
  // because a characterization test expects it.
  if (results.some(row => row.passed !== true)) process.exitCode = 1;
}
