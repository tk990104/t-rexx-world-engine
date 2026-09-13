import * as Astronomy from 'astronomy-engine';
import offsetData from './fixtures/utc-offsets-2026-09-13.json' with { type: 'json' };

// Pinned model-4 position policy. Never refresh the table under a saved model ID.
export const EPHEMERIS_TIME_POLICY = Object.freeze({
  id: 'utc-tt-2026-09-13-v1', status: 'model-4',
  historical: 'Before 1962: UT1-like civil input with Espenak-Meeus estimated delta T.',
  utc: 'From 1962: TT = UTC + published TAI-UTC offset + 32.184 seconds.',
  future: 'Beyond the source snapshot, hold the last published leap-second offset; future UTC is provisional.',
  scope: 'Geocentric positions only; not an Earth-rotation, house-angle or sunrise time adapter.',
});
const DAY_MS = 86400000, J2000_MS = Date.parse('2000-01-01T12:00:00.000Z');
const UTC_START = Date.parse('1962-01-01T00:00:00.000Z');
const SNAPSHOT_END = Date.parse('2026-09-14T00:00:00.000Z');
const OFFSETS = Object.freeze(offsetData.rows.map(([date, base, referenceMjd, rate]) =>
  Object.freeze({ epoch: Date.parse(`${date}T00:00:00.000Z`), base, referenceMjd, rate })));

export function ephemerisTimeInfo(utcInstant) {
  if (typeof utcInstant !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(utcInstant)) {
    throw new TypeError('Ephemeris time requires an explicit UTC timestamp.');
  }
  const date = new Date(utcInstant), epoch = date.getTime();
  if (!Number.isFinite(epoch) || date.toISOString().slice(0, 19) !== utcInstant.slice(0, 19)) {
    throw new TypeError('Invalid ephemeris date.');
  }
  // Include neighboring motion/light-time samples, not an expanded app date policy.
  if (epoch < Date.parse('1899-12-29T00:00:00Z') || epoch >= Date.parse('2101-01-04T00:00:00Z')) {
    throw new RangeError('Candidate ephemeris time is limited to the 1900–2100 range plus solver padding.');
  }
  const utDays = (epoch - J2000_MS) / DAY_MS;
  let ttMinusInputSeconds, basis;
  if (epoch < UTC_START) {
    ttMinusInputSeconds = Astronomy.DeltaT_EspenakMeeus(utDays);
    basis = 'historical-ut1-estimate';
  } else {
    const row = OFFSETS.findLast((entry) => entry.epoch <= epoch);
    const mjd = epoch / DAY_MS + 40587;
    ttMinusInputSeconds = 32.184 + row.base + (mjd - row.referenceMjd) * row.rate;
    basis = epoch >= SNAPSHOT_END ? 'future-held-leap-seconds' : 'published-utc-offset';
  }
  return Object.freeze({ policy: EPHEMERIS_TIME_POLICY.id, inputInstant: date.toISOString(),
    basis, ttMinusInputSeconds, ttDays: utDays + ttMinusInputSeconds / 86400 });
}

// Keep light-travel shifts in uniform TT, including shifts across a leap second.
// The inherited .ut/.date are synthetic library coordinates, NOT the event UTC.
// Never give this object to sidereal time, houses, rise/set or world-clock code.
class EphemerisTime extends Astronomy.AstroTime {
  constructor(ttDays) { super(Astronomy.AstroTime.FromTerrestrialTime(ttDays)); }
  AddDays(days) {
    if (!Number.isFinite(days) || Math.abs(days) > 1) throw new TypeError('Finite TT light-travel offset of at most one day required.');
    return new EphemerisTime(this.tt + days);
  }
}
export function makePositionEphemerisTime(utcInstant) {
  return new EphemerisTime(ephemerisTimeInfo(utcInstant).ttDays);
}
