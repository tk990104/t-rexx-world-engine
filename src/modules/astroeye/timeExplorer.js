import { normalizeEvent } from '../../domain/events/eventSchema.js';
import { calculateAstroEyeChart } from './calculation/chart.js';
import { ASTROEYE_CALCULATION_VERSION, requireCalculationVersion } from './calculation/modelVersion.js';

export const TIME_EXPLORER_LIMIT_MINUTES = 360;

/** Temporary calculation input only: never replace the saved source event. */
export function calculateTimePreview(event, offsetMinutes, { houseSystem = 'whole-sign', calculationVersion = ASTROEYE_CALCULATION_VERSION } = {}) {
  requireCalculationVersion(calculationVersion);
  if (!Number.isInteger(offsetMinutes) || Math.abs(offsetMinutes) > TIME_EXPLORER_LIMIT_MINUTES) {
    throw new RangeError('Choose a whole-minute offset within six hours of the event.');
  }
  const utcStart = new Date(Date.parse(event.utcStart) + offsetMinutes * 60000).toISOString();
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: event.scheduledLocal.timeZone, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(utcStart)).map(({ type, value }) => [type, value]));
  const calculationEvent = normalizeEvent({
    ...event,
    utcStart,
    scheduledLocal: {
      date: `${parts.year}-${parts.month}-${parts.day}`,
      time: `${parts.hour}:${parts.minute}:${parts.second}`,
      timeZone: event.scheduledLocal.timeZone,
    },
  });
  return calculateAstroEyeChart(calculationEvent, { houseSystem, calculationVersion });
}
