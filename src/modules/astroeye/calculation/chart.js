import { normalizeEvent } from '../../../domain/events/eventSchema.js';
import {
  ASTRONOMY_ENGINE_SOURCE,
  calculateAstronomyEnginePositions,
} from './astronomyEngineProvider.js';
import { zodiacPosition } from './zodiac.js';

/** Build the first byte-stable AstroEye chart result from a canonical event. */
export function calculateAstroEyeChart(eventInput) {
  const event = normalizeEvent(eventInput);
  const positions = calculateAstronomyEnginePositions(event.utcStart).map((position) => {
    const zodiac = zodiacPosition(position.longitude);
    return Object.freeze({
      ...position,
      sign: zodiac.sign,
      signIndex: zodiac.signIndex,
      degreeInSign: Math.round(zodiac.degree * 1e8) / 1e8,
    });
  });

  return Object.freeze({
    schemaVersion: 1,
    chartId: `astroeye:${event.id}:${event.utcStart}:tropical-geocentric`,
    eventId: event.id,
    calculatedFor: event.utcStart,
    location: Object.freeze({
      latitude: event.venue.latitude,
      longitude: event.venue.longitude,
    }),
    options: Object.freeze({
      zodiac: 'tropical',
      referenceFrame: 'apparent-geocentric-true-ecliptic-of-date',
      houseSystem: null,
    }),
    engine: Object.freeze({
      id: ASTRONOMY_ENGINE_SOURCE.id,
      version: ASTRONOMY_ENGINE_SOURCE.version,
      license: ASTRONOMY_ENGINE_SOURCE.license,
    }),
    positions: Object.freeze(positions),
  });
}

export function serializeAstroEyeChart(chart) {
  return `${JSON.stringify(chart, null, 2)}\n`;
}
