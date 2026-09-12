import { filterSavedEvents, sortSavedEvents } from './savedEventFilters.js';

/** Scope a durable store snapshot; never include research workspaces or transient views. */
export function matchingEventRecords(records, filters) {
  const events = sortSavedEvents(filterSavedEvents(records.events, filters), filters.sort);
  if (!events.length) throw new Error('No saved events match the applied filters. Nothing was exported.');
  const ids = new Set(events.map((event) => event.id));
  return { schemaVersion: records.schemaVersion, events,
    charts: records.charts.filter((chart) => ids.has(chart.eventId)), workspaces: [] };
}
