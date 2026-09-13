import * as Astronomy from 'astronomy-engine';
import { ASTROEYE_CALCULATION_VERSION, requireCalculationVersion } from './modelVersion.js';
import { calculateStablePlanetaryHour } from './stablePlanetaryHours.js';

const CHALDEAN_ORDER = Object.freeze(['Saturn', 'Jupiter', 'Mars', 'Sun', 'Venus', 'Mercury', 'Moon']);
const DAY_RULERS = Object.freeze({
  Sunday: 'Sun', Monday: 'Moon', Tuesday: 'Mars', Wednesday: 'Mercury',
  Thursday: 'Jupiter', Friday: 'Venus', Saturday: 'Saturn',
});

function eventDate(astroTime) {
  return astroTime?.date instanceof Date ? astroTime.date : null;
}

function localWeekday(date, timeZone) {
  return new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'long' }).format(date);
}

function rulerAt(dayRuler, sequenceOffset) {
  const start = CHALDEAN_ORDER.indexOf(dayRuler);
  return CHALDEAN_ORDER[(start + sequenceOffset) % CHALDEAN_ORDER.length];
}

/** Traditional unequal planetary hour at an event instant. */
export function calculatePlanetaryHour({ utcInstant, latitude, longitude, timeZone, calculationVersion = ASTROEYE_CALCULATION_VERSION }) {
  requireCalculationVersion(calculationVersion);
  if (calculationVersion >= 3) return calculateStablePlanetaryHour({ utcInstant, latitude, longitude, timeZone });
  const instant = new Date(utcInstant);
  if (!Number.isFinite(instant.getTime())) throw new TypeError('utcInstant must be a valid date');
  const observer = new Astronomy.Observer(Number(latitude), Number(longitude), 0);
  const previousRise = eventDate(Astronomy.SearchRiseSet(Astronomy.Body.Sun, observer, +1, instant, -2));
  const nextRise = eventDate(Astronomy.SearchRiseSet(Astronomy.Body.Sun, observer, +1, instant, +2));
  const previousSet = eventDate(Astronomy.SearchRiseSet(Astronomy.Body.Sun, observer, -1, instant, -2));
  const nextSet = eventDate(Astronomy.SearchRiseSet(Astronomy.Body.Sun, observer, -1, instant, +2));

  if (!previousRise || !nextRise || !previousSet || !nextSet) {
    return Object.freeze({
      status: 'unavailable',
      reason: 'No sunrise/sunset boundary was found within two days at this latitude.',
    });
  }

  const daytime = previousRise > previousSet;
  const intervalStart = daytime ? previousRise : previousSet;
  const intervalEnd = daytime ? nextSet : nextRise;
  const intervalMs = intervalEnd.getTime() - intervalStart.getTime();
  const hourLengthMs = intervalMs / 12;
  const segmentIndex = Math.min(11, Math.floor((instant.getTime() - intervalStart.getTime()) / hourLengthMs));
  const weekday = localWeekday(intervalStart, timeZone);
  const dayRuler = DAY_RULERS[weekday];
  const sequenceOffset = daytime ? segmentIndex : 12 + segmentIndex;
  const startMs = intervalStart.getTime() + segmentIndex * hourLengthMs;
  const endMs = startMs + hourLengthMs;

  return Object.freeze({
    status: 'exact',
    period: daytime ? 'day' : 'night',
    hourNumber: daytime ? segmentIndex + 1 : segmentIndex + 13,
    ruler: rulerAt(dayRuler, sequenceOffset),
    dayRuler,
    start: new Date(startMs).toISOString(),
    end: new Date(endMs).toISOString(),
    hourLengthMinutes: Math.round(hourLengthMs / 600) / 100,
    method: 'traditional-sunrise-sunset-chaldean',
  });
}
