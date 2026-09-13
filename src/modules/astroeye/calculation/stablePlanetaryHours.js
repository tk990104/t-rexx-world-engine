import * as Astronomy from 'astronomy-engine';

const DAY = 86400000;
const ORDER = ['Saturn', 'Jupiter', 'Mars', 'Sun', 'Venus', 'Mercury', 'Moon'];
const RULERS = { Sunday: 'Sun', Monday: 'Moon', Tuesday: 'Mars', Wednesday: 'Mercury', Thursday: 'Jupiter', Friday: 'Venus', Saturday: 'Saturn' };
const unavailable = () => Object.freeze({ status: 'unavailable',
  reason: 'No complete sunrise–sunset–sunrise interval was found within the supported two-day boundary range.' });

/** Integer edges are shared by lookup and serialization; the right edge is excluded. */
export function partitionPlanetaryInterval(start, end, instant) {
  if (![start, end, instant].every(Number.isSafeInteger) || end - start < 12 || end - start > 4 * DAY
    || instant < start || instant >= end) throw new RangeError('Invalid planetary-hour interval or instant.');
  for (let index = 0; index < 12; index++) {
    const left = start + Math.floor((end - start) * index / 12);
    const right = start + Math.floor((end - start) * (index + 1) / 12);
    if (instant < right) return Object.freeze({ index, start: left, end: right });
  }
  throw new RangeError('Planetary-hour interval could not be partitioned.');
}

/** A bounded cache only reuses roots for an identical observer and fixed UTC day. */
export function createStablePlanetaryHourCalculator({ cacheLimit = 128 } = {}) {
  if (!Number.isInteger(cacheLimit) || cacheLimit < 1 || cacheLimit > 128) throw new RangeError('Invalid solar cache limit.');
  const cache = new Map();
  function solarDay(day, latitude, longitude) {
    const key = `${day}:${latitude}:${longitude}`;
    if (cache.has(key)) {
      const hit = cache.get(key); cache.delete(key); cache.set(key, hit); return hit;
    }
    const start = day * DAY, end = start + DAY, observer = new Astronomy.Observer(latitude, longitude, 0);
    const roots = [];
    for (const direction of [1, -1]) {
      let cursor = start;
      // Solar days can be slightly shorter than 24 hours: do not assume only one
      // rise/set of each kind per UTC bucket. Bound work even on unusual geometry.
      for (let attempts = 0; attempts < 3 && cursor < end; attempts++) {
        const found = Astronomy.SearchRiseSet(Astronomy.Body.Sun, observer, direction,
          new Date(cursor), (end - cursor) / DAY);
        if (!found) break;
        const epoch = found.date.getTime();
        if (!Number.isSafeInteger(epoch) || epoch < cursor) throw new Error('Invalid solar boundary search result.');
        if (epoch >= end) break;
        roots.push(Object.freeze({ epoch, direction }));
        cursor = epoch + 1000; // Move beyond the solver's same-root neighborhood.
        if (attempts === 2) throw new Error('Solar boundary search exceeded its bounded event count.');
      }
    }
    const result = Object.freeze(roots);
    cache.set(key, result);
    if (cache.size > cacheLimit) cache.delete(cache.keys().next().value);
    return result;
  }
  return function calculate({ utcInstant, latitude, longitude, timeZone }) {
    const date = new Date(utcInstant), instant = date.getTime();
    if (!Number.isFinite(instant)) throw new TypeError('utcInstant must be a valid date');
    if (!Number.isFinite(latitude) || Math.abs(latitude) >= 90
      || !Number.isFinite(longitude) || Math.abs(longitude) > 180) throw new RangeError('Invalid planetary-hour observer coordinates.');
    if (typeof timeZone !== 'string' || !timeZone) throw new TypeError('A venue time zone is required.');
    const weekday = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'long' });
    const day = Math.floor(instant / DAY), roots = [];
    for (let offset = -2; offset <= 2; offset++) roots.push(...solarDay(day + offset, latitude, longitude));
    roots.sort((a, b) => a.epoch - b.epoch);
    const rises = roots.filter((r) => r.direction === 1);
    const previous = rises.findLast((r) => r.epoch <= instant), next = rises.find((r) => r.epoch > instant);
    if (!previous || !next || instant - previous.epoch > 2 * DAY || next.epoch - instant > 2 * DAY) return unavailable();
    const sets = roots.filter((r) => r.direction === -1 && r.epoch > previous.epoch && r.epoch < next.epoch);
    if (sets.length !== 1) return unavailable();
    const sunset = sets[0].epoch, daytime = instant < sunset;
    const start = daytime ? previous.epoch : sunset, end = daytime ? sunset : next.epoch;
    const segment = partitionPlanetaryInterval(start, end, instant);
    const dayRuler = RULERS[weekday.format(new Date(previous.epoch))];
    const offset = segment.index + (daytime ? 0 : 12);
    return Object.freeze({
      status: 'exact', period: daytime ? 'day' : 'night', hourNumber: offset + 1,
      ruler: ORDER[(ORDER.indexOf(dayRuler) + offset) % 7], dayRuler,
      start: new Date(segment.start).toISOString(), end: new Date(segment.end).toISOString(),
      hourLengthMinutes: Math.round((end - start) / 12 / 600) / 100,
      method: 'traditional-sunrise-sunset-chaldean',
      boundaryMethod: 'utc-day-anchored-half-open-ms',
    });
  };
}

export const calculateStablePlanetaryHour = createStablePlanetaryHourCalculator();
