import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { calculateHouses } from '../src/modules/astroeye/calculation/houses.js';

const COMMIT = '1090b1a0573cce6a981b468b4b8355ba64e23474';
const JDS = [2456334.5, 2456334.75, 2456335, 2456335.25];
const angle = (v) => Number.isFinite(v) && v >= 0 && v < 360;
const error = (a, b) => Math.abs(((a - b + 540) % 360) - 180) * 3600;

// Input is supplied explicitly for local reference review; no download or bundled
// Swiss data/runtime. This checker does not grant redistribution rights or close A1.
export function comparePolarCandidate(pack, calculate = calculateHouses) {
  const fail = () => { throw new Error('Unsupported polar candidate reference contract'); };
  if (pack?.schemaVersion !== 1 || pack.source?.commit !== COMMIT
    || pack.source?.repository !== 'https://github.com/astrorigin/swisseph'
    || pack.source?.path !== 'setest/t.exp' || pack.source?.engineVersion !== '2.10.03'
    || pack.source?.retrievedOn !== '2026-09-14' || pack.toleranceArcseconds !== 60
    || pack.wholeSignToleranceArcseconds !== 0 || !Array.isArray(pack.cases) || pack.cases.length !== 16) fail();
  const seen = new Set();
  const results = pack.cases.map((r) => {
    if (!r || ![89.9, -89.9].includes(r.latitude) || r.longitude !== 0 || !JDS.includes(r.jd)
      || !['equal', 'whole-sign'].includes(r.system) || r.rc !== 0
      || r.utcInstant !== new Date((r.jd - 2440587.5) * 86400000).toISOString()
      || !angle(r.ascendant) || !angle(r.midheaven) || !Array.isArray(r.cusps) || r.cusps.length !== 12
      || !Array.from(r.cusps).every(angle)) fail();
    const key = `${r.latitude}/${r.jd}/${r.system}`;
    if (seen.has(key)) fail(); seen.add(key);
    const base = r.latitude > 0 ? (r.system === 'equal' ? 397 : 421) : (r.system === 'equal' ? 1237 : 1261);
    if (r.section !== `6.1.${base + JDS.indexOf(r.jd) * 3}`) fail();
    const actual = calculate({ utcInstant: r.utcInstant, latitude: r.latitude, longitude: r.longitude, system: r.system, calculationVersion: 4 });
    if (!actual?.angles || !Array.isArray(actual.cusps) || actual.cusps.length !== 12) throw new Error('Invalid calculated polar output');
    const ascendant = error(actual.angles.ascendant, r.ascendant), midheaven = error(actual.angles.midheaven, r.midheaven);
    const maximumCusp = Math.max(...actual.cusps.map((c, i) => error(c.longitude, r.cusps[i])));
    return { section: r.section, utcInstant: r.utcInstant, latitude: r.latitude, system: r.system,
      errorArcseconds: { ascendant, midheaven, maximumCusp },
      passed: ascendant <= 60 && midheaven <= 60 && maximumCusp <= (r.system === 'whole-sign' ? 0 : 60) };
  });
  return { calculationVersion: 4, scope: 'Local numerical reference review; redistribution not cleared; A1 remains open.',
    results, passed: results.every((r) => r.passed) };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.length !== 4 || process.argv[2] !== '--fixture') throw new Error('Local review only: node scripts/astroeye-polar-candidate.mjs --fixture PATH');
  const report = comparePolarCandidate(JSON.parse(readFileSync(process.argv[3], 'utf8')));
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exitCode = 1;
}
