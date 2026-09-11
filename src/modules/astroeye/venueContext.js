/** Plain-text view model; source/event strings are never interpreted as markup. */
export function createVenueContextModel(selection) {
  if (!selection) return null;
  const { event, chart, offsetMinutes = 0, isShared = false } = selection;
  const utc = (value) => value.replace('T', ' ').replace('.000Z', ' UTC');
  const source = event.source.kind === 'provider'
    ? `${event.source.provider} · event ${event.source.sourceEventId} · retrieved ${utc(event.source.retrievedAt)}`
    : 'Manual entry · user-supplied event details';
  return Object.freeze({
    title: event.title,
    venue: event.venue.name,
    coordinates: `${event.venue.latitude.toFixed(5)}, ${event.venue.longitude.toFixed(5)}`,
    coordinateSource: event.venue.coordinateSource,
    eventTime: `${event.scheduledLocal.date} ${event.scheduledLocal.time} · ${event.scheduledLocal.timeZone}\n${utc(event.utcStart)}`,
    chartTime: utc(chart.calculatedFor),
    mode: offsetMinutes === 0 ? 'Event start' : `${offsetMinutes > 0 ? '+' : '−'}${Math.abs(offsetMinutes)} minutes from event start`,
    storage: isShared ? 'Unsaved shared / scene selection' : 'Saved event selected',
    method: `${chart.options.houseSystem} houses · ${chart.options.zodiac} zodiac`,
    source,
    summary: `1 selected venue · ${chart.positions.length} bodies · ${chart.aspects.length} major aspects`,
  });
}
