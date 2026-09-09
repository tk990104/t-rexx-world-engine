import * as Astronomy from 'astronomy-engine';

import { normalizeLongitude, zodiacPosition } from './zodiac.js';

export const HOUSE_SYSTEMS = Object.freeze(['whole-sign', 'equal']);

function radians(degrees) {
  return degrees * Math.PI / 180;
}

function degrees(radiansValue) {
  return radiansValue * 180 / Math.PI;
}

/** Calculate tropical Ascendant and Midheaven from apparent sidereal time. */
export function calculateAngles(utcInstant, latitude, longitude) {
  const date = new Date(utcInstant);
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!Number.isFinite(date.getTime())) throw new TypeError('utcInstant must be a valid date');
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) throw new RangeError('latitude must be between -90 and 90');
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) throw new RangeError('longitude must be between -180 and 180');
  if (Math.abs(lat) === 90) throw new RangeError('Ascendant is undefined exactly at a geographic pole');

  const siderealDegrees = normalizeLongitude(Astronomy.SiderealTime(date) * 15 + lon);
  const theta = radians(siderealDegrees);
  const obliquity = Astronomy.e_tilt(Astronomy.MakeTime(date)).tobl;
  const epsilon = radians(obliquity);
  const phi = radians(lat);

  const ascendant = normalizeLongitude(degrees(Math.atan2(
    -Math.cos(theta),
    Math.sin(theta) * Math.cos(epsilon) + Math.tan(phi) * Math.sin(epsilon),
  )) + 180);
  const midheaven = normalizeLongitude(degrees(Math.atan2(
    Math.sin(theta),
    Math.cos(theta) * Math.cos(epsilon),
  )));

  return Object.freeze({
    ascendant,
    midheaven,
    localSiderealDegrees: siderealDegrees,
    trueObliquityDegrees: obliquity,
  });
}

export function calculateHouses({ utcInstant, latitude, longitude, system = 'whole-sign' }) {
  if (!HOUSE_SYSTEMS.includes(system)) throw new RangeError(`Unsupported house system: ${system}`);
  const angles = calculateAngles(utcInstant, latitude, longitude);
  const firstCusp = system === 'whole-sign'
    ? Math.floor(angles.ascendant / 30) * 30
    : angles.ascendant;
  const cusps = Array.from({ length: 12 }, (_, index) => {
    const zodiac = zodiacPosition(firstCusp + index * 30);
    return Object.freeze({
      house: index + 1,
      longitude: zodiac.longitude,
      sign: zodiac.sign,
    });
  });

  return Object.freeze({
    system,
    angles,
    cusps: Object.freeze(cusps),
  });
}

export function houseForLongitude(longitude, houses) {
  if (!houses?.cusps?.length) throw new TypeError('A calculated house set is required');
  return Math.floor(normalizeLongitude(longitude - houses.cusps[0].longitude) / 30) + 1;
}
