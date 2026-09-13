import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import * as Astronomy from 'astronomy-engine';
import { calculatePlanetaryHour } from '../src/modules/astroeye/calculation/planetaryHours.js';

export function readSunReferences() {
  return JSON.parse(readFileSync(new URL('../src/modules/astroeye/calculation/fixtures/usno-sun-boundaries.json', import.meta.url), 'utf8'));
}
export function parseSunReference(row, { allowPartial = false } = {}) {
  const fail = () => { throw new Error('Invalid USNO solar reference metadata or boundary data'); };
  const response = row?.response, data = response?.properties?.data;
  if (!row || typeof row.id !== 'string' || !row.id || !/^\d{4}-\d{2}-\d{2}$/.test(row.date)
    || !Number.isFinite(row.latitude) || Math.abs(row.latitude) >= 90
    || !Number.isFinite(row.longitude) || Math.abs(row.longitude) > 180
    || !Number.isFinite(row.offsetHours) || Math.abs(row.offsetHours) > 14
    || typeof row.timeZone !== 'string' || !row.timeZone
    || response?.error || response?.apiversion !== '4.0.1' || response.type !== 'Feature'
    || response.geometry?.type !== 'Point' || response.geometry.coordinates?.length !== 2
    || response.geometry.coordinates[0] !== row.longitude || response.geometry.coordinates[1] !== row.latitude
    || !data || data.isdst !== false || data.tz !== row.offsetHours || !Array.isArray(data.sundata)
    || data.sundata.some((entry) => !entry || typeof entry.phen !== 'string')) fail();
  const date = new Date(row.date + 'T00:00:00Z');
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== row.date
    || data.year !== date.getUTCFullYear() || data.month !== date.getUTCMonth() + 1 || data.day !== date.getUTCDate()
    || data.day_of_week !== new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' }).format(date)) fail();
  let url;
  try { url = new URL(row.url); new Intl.DateTimeFormat('en-US', { timeZone: row.timeZone }).format(date); } catch { fail(); }
  if (url.origin !== 'https://aa.usno.navy.mil' || url.pathname !== '/api/rstt/oneday'
    || url.searchParams.size !== 3 || url.searchParams.get('date') !== row.date
    || url.searchParams.get('coords') !== [row.latitude, row.longitude].join(',')
    || url.searchParams.get('tz') !== String(row.offsetHours)) fail();
  const utcAt = (time) => {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) fail();
    const utc = new Date(Date.parse(row.date + 'T' + time + ':00Z') - row.offsetHours * 3600000);
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: row.timeZone,
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(utc).map(({ type, value }) => [type, value]));
    if ([parts.year, parts.month, parts.day].join('-') !== row.date || [parts.hour, parts.minute].join(':') !== time) fail();
    return utc.toISOString();
  };
  const rises = data.sundata.filter((entry) => entry.phen === 'Rise');
  const sets = data.sundata.filter((entry) => entry.phen === 'Set');
  const absent = data.sundata.filter((entry) => entry.phen === 'Object continuously below the Horizon');
  const continuousDay = data.sundata.filter((entry) => entry.phen === 'Object continuously above the Horizon');
  if (absent.length || continuousDay.length) {
    const notices = [...absent, ...continuousDay];
    if (notices.length !== 1 || notices[0].time !== null || rises.length || sets.length) fail();
    return { id: row.id, status: absent.length ? 'polar-night' : 'polar-day', noon: utcAt('12:00') };
  }
  // Only the separate transition pack opts into single-boundary days. Ordinary
  // references still fail if a rise or set disappears from damaged fixture data.
  if (allowPartial && rises.length + sets.length === 1) {
    const kind = rises.length ? 'rise' : 'set';
    return { id: row.id, status: kind + '-only', [kind]: utcAt((rises[0] || sets[0]).time) };
  }
  if (rises.length !== 1 || sets.length !== 1) fail();
  const rise = utcAt(rises[0].time), set = utcAt(sets[0].time);
  if (rise >= set) fail(); // This pack supports ordinary same-local-day pairs only.
  return { id: row.id, status: 'rise-set', rise, set };
}

export function compareSunReferences(pack = readSunReferences()) {
  if (pack?.schemaVersion !== 1 || pack.source?.id !== 'usno-rstt-oneday'
    || pack.source?.retrievedOn !== '2026-09-13' || pack.toleranceSeconds !== 120
    || pack.boundaryProbeSeconds !== 240 || !Array.isArray(pack.cases) || pack.cases.length !== 8
    || new Set(pack.cases.map((row) => row.id)).size !== 8) throw new Error('Unsupported solar reference contract');
  return pack.cases.map((row) => {
    const reference = parseSunReference(row);
    if (reference.status === 'polar-night' || reference.status === 'polar-day') {
      const hour = calculatePlanetaryHour({ ...row, utcInstant: reference.noon });
      return { id: row.id, status: reference.status, passed: hour.status === 'unavailable' };
    }
    const observer = new Astronomy.Observer(row.latitude, row.longitude, 0);
    const errors = {};
    for (const [kind, direction] of [['rise', 1], ['set', -1]]) {
      const expected = Date.parse(reference[kind]);
      const actual = Astronomy.SearchRiseSet(Astronomy.Body.Sun, observer, direction, new Date(expected - 3600000), 2 / 24);
      errors[kind] = actual ? Math.abs(actual.date.getTime() - expected) / 1000 : null;
    }
    return { id: row.id, status: reference.status, errorSeconds: errors,
      passed: Object.values(errors).every((v) => v !== null && v <= pack.toleranceSeconds) };
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const results = compareSunReferences();
  console.log(JSON.stringify(results, null, 2));
  if (results.some((r) => !r.passed)) process.exitCode = 1;
}
