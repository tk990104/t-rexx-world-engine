import { resolveZonedLocalTime } from '../../domain/events/eventSchema.js';

export const SPORTSDB_SOURCE = Object.freeze({
  id: 'thesportsdb', title: 'TheSportsDB', license: 'Provider terms; not MIT',
  attribution: 'Schedule and venue data from TheSportsDB',
  url: 'https://www.thesportsdb.com/',
  termsUrl: 'https://www.thesportsdb.com/docs_terms_of_use.php',
  cachePolicy: 'Server cache: 15 minutes; bounded requests; fetched time displayed; no automatic saved-event updates.',
});

const text = (value) => typeof value === 'string' ? value.trim().slice(0, 200) : '';
const id = (value) => /^\d{1,12}$/.test(String(value ?? '')) ? String(value) : null;

export function validScheduleDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) return false;
  try { return resolveZonedLocalTime({ localDate: date, localTime: '12:00', timeZone: 'UTC' }).status === 'exact'; }
  catch { return false; }
}

/** Provider dateEvent + strTime are UTC by provider convention, not venue local. */
export function normalizeSportsSchedule(payload, retrievedAt) {
  if (!payload || !Object.hasOwn(payload, 'events') || (payload.events !== null && !Array.isArray(payload.events))) {
    throw new Error('The schedule provider returned an unexpected response.');
  }
  const seen = new Set();
  let skipped = 0;
  const events = (payload.events ?? []).slice(0, 100).flatMap((raw) => {
    if (!raw || raw.idLeague !== '4391' || !id(raw.idEvent) || !text(raw.strHomeTeam) || !text(raw.strAwayTeam) || seen.has(raw.idEvent)) {
      skipped += 1;
      return [];
    }
    seen.add(raw.idEvent);
    const status = text(raw.strStatus);
    const uncertain = /postpon|cancel|suspend|abandon|time.*(defined|confirm)|\btbd\b/i.test(status) || /^(yes|true|1)$/i.test(raw.strPostponed ?? '');
    const clock = text(raw.strTime).replace(/Z$/, '');
    let utcStart = null;
    if (!uncertain && validScheduleDate(raw.dateEvent) && /^\d{2}:\d{2}(:\d{2})?$/.test(clock) && !/^00:00(:00)?$/.test(clock)) {
      try { utcStart = resolveZonedLocalTime({ localDate: raw.dateEvent, localTime: clock, timeZone: 'UTC' }).candidates[0]; } catch { /* Missing time must be reviewed. */ }
    }
    return [{
      sourceEventId: raw.idEvent, title: `${text(raw.strAwayTeam)} at ${text(raw.strHomeTeam)}`,
      home: text(raw.strHomeTeam), away: text(raw.strAwayTeam), sport: 'American Football', competition: 'NFL',
      utcStart, status: status || 'Status not supplied',
      timeNote: utcStart ? 'Provider schedule time; verify before saving.' : 'Start time unavailable or uncertain. Enter a verified time.',
      venueId: id(raw.idVenue), venueName: text(raw.strVenue), city: text(raw.strCity), country: text(raw.strCountry),
      source: { kind: 'provider', provider: SPORTSDB_SOURCE.id, sourceEventId: raw.idEvent, retrievedAt },
    }];
  });
  return { events, skipped, coverage: 'limited', retrievedAt, source: SPORTSDB_SOURCE.id };
}

/** Accept only explicit decimal pairs or DMS coordinates, never a map URL. */
export function parseVenueCoordinates(value) {
  if (typeof value !== 'string') return null;
  let match = value.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  let latitude, longitude;
  if (match) [latitude, longitude] = [Number(match[1]), Number(match[2])];
  else {
    match = value.trim().match(/^(\d{1,2})°\s*(\d{1,2})[′']\s*(\d{1,2}(?:\.\d+)?)[″"]\s*([NS])\s*[,;]?\s*(\d{1,3})°\s*(\d{1,2})[′']\s*(\d{1,2}(?:\.\d+)?)[″"]\s*([EW])$/i);
    if (!match || [match[2], match[3], match[6], match[7]].some((part) => Number(part) >= 60)) return null;
    latitude = (Number(match[1]) + Number(match[2]) / 60 + Number(match[3]) / 3600) * (/s/i.test(match[4]) ? -1 : 1);
    longitude = (Number(match[5]) + Number(match[6]) / 60 + Number(match[7]) / 3600) * (/w/i.test(match[8]) ? -1 : 1);
  }
  return Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 ? { latitude, longitude } : null;
}

export function normalizeSportsVenue(payload, venueId) {
  if (!payload || !Object.hasOwn(payload, 'venues') || (payload.venues !== null && !Array.isArray(payload.venues))) {
    throw new Error('The venue provider returned an unexpected response.');
  }
  const raw = payload.venues?.find((venue) => venue?.idVenue === venueId);
  if (!raw) return null;
  return { id: venueId, name: text(raw.strVenue), location: text(raw.strLocation),
    timeZoneHint: text(raw.strTimezone), coordinates: parseVenueCoordinates(raw.strMap) };
}

export function scheduleLocalTime(utcStart, timeZone) {
  const instant = new Date(utcStart);
  if (!utcStart || !Number.isFinite(instant.getTime()) || !timeZone?.trim()) throw new Error('Choose a venue time zone.');
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(instant).map(({ type, value }) => [type, value]));
  return { localDate: `${parts.year}-${parts.month}-${parts.day}`, localTime: `${parts.hour}:${parts.minute}:${parts.second}`, utcStart: instant.toISOString() };
}

export function createSportsScheduleClient({ fetchImpl = globalThis.fetch } = {}) {
  async function get(query, signal) {
    const response = await fetchImpl(`/api/astroeye/sports?${new URLSearchParams(query)}`, { signal });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Sports schedules are unavailable. Try again later.');
    return data;
  }
  return {
    schedule: (date, signal) => get(date ? { date } : {}, signal),
    venue: (venueId, signal) => get({ venue: venueId }, signal),
  };
}
