import { normalizeEvent } from '../../domain/events/eventSchema.js';

/** Copy calculation inputs only: never reuse record identity or provider provenance. */
export function eventTemplateDraft(input, houseSystem = 'whole-sign') {
  const event = normalizeEvent(input);
  if (!['whole-sign', 'equal'].includes(houseSystem)) throw new RangeError('Unsupported template house system');
  return Object.freeze({
    title: event.title, sport: event.sport, competition: event.competition,
    home: event.participants.home, away: event.participants.away,
    localDate: event.scheduledLocal.date, localTime: event.scheduledLocal.time,
    timeZone: event.scheduledLocal.timeZone, utcStart: event.utcStart,
    venueName: event.venue.name, latitude: event.venue.latitude, longitude: event.venue.longitude,
    durationMinutes: event.durationMinutes ?? '', houseSystem,
  });
}
