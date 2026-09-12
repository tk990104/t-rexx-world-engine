import * as Cesium from 'cesium';
import { filterSavedEvents, normalizeSavedEventFilters, sortSavedEvents } from './savedEventFilters.js';

export const SAVED_EVENT_LIMIT = 100;
export const savedEventEntityId = (id) => `t-rexx-astroeye-saved-${encodeURIComponent(id)}`;

/** Opt-in, bounded local-record overlay. No chart calculation, navigation or writes. */
export function createSavedEventLayer({ viewer, listEvents, getSelection, eventBus }) {
  let enabled = false, suspended = false, disposed = false, loading = false;
  let generation = 0, records = [], error = '';
  let filters = normalizeSavedEventFilters();
  const entities = new Map(), listeners = new Set();
  function framePoints() {
    if (!enabled || suspended || disposed || loading || error) return [];
    const selected = getSelection();
    const events = records.filter((event) => entities.has(savedEventEntityId(event.id)));
    if (selected && !selected.isShared && records.some((event) => event.id === selected.event.id)
      && filterSavedEvents([selected.event], filters).length) events.push(selected.event);
    return events.map((event) => ({ latitude: event.venue.latitude, longitude: event.venue.longitude }));
  }
  const state = () => ({ enabled, suspended, loading, error, shown: entities.size, total: records.length,
    matched: filterSavedEvents(records, filters).length, frameable: framePoints().length, limit: SAVED_EVENT_LIMIT });
  const notify = () => { for (const listener of listeners) listener(state()); };
  function clear() {
    for (const id of entities.keys()) viewer.entities.removeById(id);
    entities.clear();
    viewer.scene.requestRender();
  }
  function render() {
    clear();
    if (enabled && !suspended && !disposed) {
      const selected = getSelection();
      const events = sortSavedEvents(filterSavedEvents(records, filters), filters.sort).filter((event) => selected?.isShared || event.id !== selected?.event.id).slice(0, SAVED_EVENT_LIMIT);
      try {
        for (const event of events) {
          const id = savedEventEntityId(event.id);
          viewer.entities.add({ id, name: event.title,
            position: Cesium.Cartesian3.fromDegrees(event.venue.longitude, event.venue.latitude, 80),
            point: { color: Cesium.Color.fromCssColorString('#78e7ff'), pixelSize: 9,
              outlineColor: Cesium.Color.fromCssColorString('#08202a'), outlineWidth: 2,
              disableDepthTestDistance: Number.POSITIVE_INFINITY },
            label: { text: `${event.title}\nEvent start · ${event.scheduledLocal.date} ${event.scheduledLocal.time.slice(0, 5)} ${event.scheduledLocal.timeZone}`,
              font: '12px sans-serif', fillColor: Cesium.Color.WHITE,
              outlineColor: Cesium.Color.fromCssColorString('#08202a'), outlineWidth: 3,
              style: Cesium.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new Cesium.Cartesian2(0, -18),
              distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 200000),
              disableDepthTestDistance: Number.POSITIVE_INFINITY },
            properties: { moduleId: 'astroeye', eventId: event.id, utcStart: event.utcStart },
          });
          entities.set(id, event.id);
        }
      } catch {
        clear();
        error = 'Saved-event markers could not be drawn. Hide and show the map to retry.';
      }
    }
    viewer.scene.requestRender();
    notify();
  }
  async function refresh() {
    if (!enabled || disposed) return;
    const request = ++generation;
    loading = true; error = ''; notify();
    try {
      const result = await listEvents();
      if (request !== generation || disposed || !enabled) return;
      records = [...result];
    } catch {
      if (request !== generation || disposed || !enabled) return;
      records = [];
      error = 'Saved events could not be read. Hide and show the map to retry.';
    }
    loading = false;
    render();
  }
  const unsubscribes = ['astroeye:event-saved', 'astroeye:event-deleted', 'astroeye:records-imported'].map((type) => eventBus.on(type, () => { void refresh(); }));
  unsubscribes.push(eventBus.on('astroeye:event-selected', render));
  return Object.freeze({
    state,
    framePoints,
    subscribe(listener) { listeners.add(listener); listener(state()); return () => listeners.delete(listener); },
    eventIdForEntity: (id) => entities.get(id) ?? null,
    refresh,
    setFilters(input) {
      if (disposed) return;
      filters = normalizeSavedEventFilters(input);
      render();
    },
    async setEnabled(value) {
      if (disposed) return;
      enabled = Boolean(value); generation++;
      if (enabled) await refresh();
      else { loading = false; error = ''; records = []; render(); }
    },
    setSuspended(value) { suspended = Boolean(value); render(); },
    destroy() {
      if (disposed) return;
      disposed = true; generation++; enabled = false; loading = false;
      unsubscribes.forEach((unsubscribe) => unsubscribe()); clear(); listeners.clear(); records = [];
    },
  });
}
