/** Inclusive venue-local calendar dates, independent of the viewer's time zone. */
export function normalizeSavedEventFilters({ query = '', dateFrom = '', dateTo = '' } = {}) {
  if (typeof query !== 'string' || query.length > 100) throw new Error('Use a search of 100 characters or fewer.');
  for (const value of [dateFrom, dateTo]) {
    if (value === '') continue;
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Use dates in YYYY-MM-DD format.');
    const date = new Date(`${value}T00:00:00Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error('Choose a valid calendar date.');
  }
  if (dateFrom && dateTo && dateFrom > dateTo) throw new Error('The start date must be on or before the end date.');
  return Object.freeze({ query: query.trim().replace(/\s+/g, ' '), dateFrom, dateTo });
}

export function filterSavedEvents(events, input = {}) {
  const { query, dateFrom, dateTo } = normalizeSavedEventFilters(input);
  const needle = query.toLowerCase();
  return events.filter((event) => {
    const date = event.scheduledLocal.date;
    if ((dateFrom && date < dateFrom) || (dateTo && date > dateTo)) return false;
    const text = [event.title, event.sport, event.competition, event.participants?.home,
      event.participants?.away, event.venue.name].filter((value) => typeof value === 'string').join(' ').replace(/\s+/g, ' ').toLowerCase();
    return !needle || text.includes(needle);
  });
}
