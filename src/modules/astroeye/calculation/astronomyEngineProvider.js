import * as Astronomy from 'astronomy-engine';

import { normalizeLongitude } from './zodiac.js';

export const ASTRONOMY_ENGINE_VERSION = '2.1.19';
export const ASTROEYE_BODIES = Object.freeze([
  'Sun', 'Moon', 'Mercury', 'Venus', 'Mars',
  'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto',
]);

export const ASTRONOMY_ENGINE_SOURCE = Object.freeze({
  id: 'astronomy-engine',
  title: 'Astronomy Engine',
  license: 'MIT',
  attribution: 'Astronomy Engine by Don Cross',
  cachePolicy: 'Calculations are local and deterministic; normalized chart results may be cached by input hash.',
  url: 'https://github.com/cosinekitty/astronomy',
  version: ASTRONOMY_ENGINE_VERSION,
});

function round(value, places = 8) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function eclipticCoordinates(body, date) {
  if (body === 'Sun') {
    const result = Astronomy.SunPosition(date);
    return { longitude: result.elon, latitude: result.elat };
  }
  if (body === 'Moon') {
    const result = Astronomy.EclipticGeoMoon(date);
    return { longitude: result.lon, latitude: result.lat };
  }
  const vector = Astronomy.GeoVector(Astronomy.Body[body], date, true);
  const result = Astronomy.Ecliptic(vector);
  return { longitude: result.elon, latitude: result.elat };
}

function signedLongitudeDelta(from, to) {
  return ((normalizeLongitude(to) - normalizeLongitude(from) + 540) % 360) - 180;
}

/** Apparent geocentric true-ecliptic-of-date positions for AstroEye. */
export function calculateAstronomyEnginePositions(utcInstant) {
  const date = new Date(utcInstant);
  if (!Number.isFinite(date.getTime())) throw new TypeError('utcInstant must be a valid date');
  const earlier = new Date(date.getTime() - 6 * 60 * 60 * 1000);
  const later = new Date(date.getTime() + 6 * 60 * 60 * 1000);

  return ASTROEYE_BODIES.map((body) => {
    const current = eclipticCoordinates(body, date);
    const before = eclipticCoordinates(body, earlier);
    const after = eclipticCoordinates(body, later);
    const motionDegPerDay = signedLongitudeDelta(before.longitude, after.longitude) * 2;
    return Object.freeze({
      body,
      longitude: round(normalizeLongitude(current.longitude)),
      latitude: round(current.latitude),
      motionDegPerDay: round(motionDegPerDay),
      retrograde: motionDegPerDay < 0,
    });
  });
}
