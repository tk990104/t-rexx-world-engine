import { normalizeEvent } from '../../../domain/events/eventSchema.js';
import {
  ASTRONOMY_ENGINE_SOURCE,
  calculateAstronomyEnginePositions,
} from './astronomyEngineProvider.js';
import { calculateMajorAspects } from './aspects.js';
import { calculateHouses, houseForLongitude, HOUSE_SYSTEMS } from './houses.js';
import { calculatePlanetaryHour } from './planetaryHours.js';
import { zodiacPosition } from './zodiac.js';
import { ASTROEYE_CALCULATION_VERSION, requireCalculationVersion } from './modelVersion.js';

/** Build the first byte-stable AstroEye chart result from a canonical event. */
export function calculateAstroEyeChart(eventInput, { houseSystem = 'whole-sign', calculationVersion = ASTROEYE_CALCULATION_VERSION } = {}) {
  requireCalculationVersion(calculationVersion);
  const event = normalizeEvent(eventInput);
  if (!HOUSE_SYSTEMS.includes(houseSystem)) throw new RangeError(`Unsupported house system: ${houseSystem}`);
  const houses = calculateHouses({
    utcInstant: event.utcStart,
    latitude: event.venue.latitude,
    longitude: event.venue.longitude,
    system: houseSystem,
  });
  const positions = calculateAstronomyEnginePositions(event.utcStart).map((position) => {
    const zodiac = zodiacPosition(position.longitude);
    return Object.freeze({
      ...position,
      sign: zodiac.sign,
      signIndex: zodiac.signIndex,
      degreeInSign: Math.round(zodiac.degree * 1e8) / 1e8,
      house: houseForLongitude(position.longitude, houses),
    });
  });

  return Object.freeze({
    schemaVersion: 1,
    calculationVersion,
    chartId: `astroeye:${event.id}:${event.utcStart}:tropical-geocentric:${houseSystem}`,
    eventId: event.id,
    calculatedFor: event.utcStart,
    location: Object.freeze({
      latitude: event.venue.latitude,
      longitude: event.venue.longitude,
    }),
    options: Object.freeze({
      zodiac: 'tropical',
      referenceFrame: 'apparent-geocentric-true-ecliptic-of-date',
      houseSystem,
    }),
    engine: Object.freeze({
      id: ASTRONOMY_ENGINE_SOURCE.id,
      version: ASTRONOMY_ENGINE_SOURCE.version,
      license: ASTRONOMY_ENGINE_SOURCE.license,
    }),
    positions: Object.freeze(positions),
    houses,
    aspects: calculateMajorAspects(positions),
    planetaryHour: calculatePlanetaryHour({
      utcInstant: event.utcStart,
      latitude: event.venue.latitude,
      longitude: event.venue.longitude,
      timeZone: event.scheduledLocal.timeZone,
    }),
  });
}

export function serializeAstroEyeChart(chart) {
  return `${JSON.stringify(chart, null, 2)}\n`;
}
