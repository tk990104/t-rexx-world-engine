/** Inclusive venue-local calendar dates, independent of the viewer's time zone. */
export function normalizeSavedEventFilters({ query = '', dateFrom = '', dateTo = '', sort = 'newest' } = {}) {
  if (!['newest', 'oldest'].includes(sort)) throw new Error('Choose newest or oldest event start first.');
  if (typeof query !== 'string' || query.length > 100) throw new Error('Use a search of 100 characters or fewer.');
  for (const value of [dateFrom, dateTo]) {
    if (value === '') continue;
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Use dates in YYYY-MM-DD format.');
    const date = new Date(`${value}T00:00:00Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error('Choose a valid calendar date.');
  }
  if (dateFrom && dateTo && dateFrom > dateTo) throw new Error('The start date must be on or before the end date.');
  return Object.freeze({ query: query.trim().replace(/\s+/g, ' '), dateFrom, dateTo, sort });
}

/** Sort actual UTC instants; equal starts always use a stable record-ID tie break. */
export function sortSavedEvents(events, sort = 'newest') {
  normalizeSavedEventFilters({ sort });
  return [...events].sort((a, b) => {
    const time = Date.parse(a.utcStart) - Date.parse(b.utcStart);
    return time ? (sort === 'oldest' ? time : -time) : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

export const SAVED_EVENT_PAGE_SIZE = 25;
export function pageSavedEvents(events, requestedPage = 0) {
  const pageCount = Math.max(1, Math.ceil(events.length / SAVED_EVENT_PAGE_SIZE));
  const page = Math.max(0, Math.min(pageCount - 1, Number.isInteger(requestedPage) ? requestedPage : 0));
  const start = page * SAVED_EVENT_PAGE_SIZE;
  return { page, pageCount, total: events.length, from: events.length ? start + 1 : 0,
    to: Math.min(start + SAVED_EVENT_PAGE_SIZE, events.length), items: events.slice(start, start + SAVED_EVENT_PAGE_SIZE) };
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
