import { normalizeEvent } from '../../domain/events/eventSchema.js';
import { calculateAstroEyeChart } from './calculation/chart.js';

function requireService(service, name, methods) {
  if (!service || methods.some((method) => typeof service[method] !== 'function')) {
    throw new TypeError(`${name} must provide ${methods.join(', ')}`);
  }
  return service;
}

function defaultIdFactory() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return `astroeye-${globalThis.crypto.randomUUID()}`;
  throw new Error('This browser cannot create a unique event ID');
}

export function eventFromDraft(draft, idFactory = defaultIdFactory) {
  if (!draft || typeof draft !== 'object') throw new TypeError('Event draft is required');
  if (draft.source?.kind === 'provider' && draft.scheduleReviewed !== true) {
    throw new Error('Check the schedule time, venue, and coordinates before saving.');
  }
  return normalizeEvent({
    id: draft.id || idFactory(),
    title: draft.title,
    sport: draft.sport,
    competition: draft.competition,
    participants: { home: draft.home, away: draft.away },
    scheduledLocal: {
      date: draft.localDate,
      time: draft.localTime,
      timeZone: draft.timeZone,
    },
    utcStart: draft.utcStart || undefined,
    durationMinutes: draft.durationMinutes === '' || draft.durationMinutes == null
      ? null
      : draft.durationMinutes,
    venue: {
      name: draft.venueName,
      latitude: draft.latitude,
      longitude: draft.longitude,
      coordinateSource: draft.coordinateSource || 'user-confirmed',
    },
    source: draft.source ?? { kind: 'manual' },
  });
}

/** Coordinates AstroEye records, calculations, world time, and presentation. */
export function createAstroEyeWorkspaceController({
  recordStore,
  worldClock,
  moduleState,
  eventBus,
  presentEvent = async () => {},
  idFactory = defaultIdFactory,
} = {}) {
  requireService(recordStore, 'recordStore', [
    'saveEventWithChart', 'saveChart', 'getEvent', 'listEvents', 'listCharts',
    'deleteEvent', 'serializeRecords', 'importRecords',
  ]);
  requireService(worldClock, 'worldClock', ['setMode']);
  requireService(moduleState, 'moduleState', ['set', 'get', 'clear', 'setActiveModule']);
  requireService(eventBus, 'eventBus', ['emit']);
  if (typeof presentEvent !== 'function') throw new TypeError('presentEvent must be a function');
  if (typeof idFactory !== 'function') throw new TypeError('idFactory must be a function');

  async function activate(event, chart) {
    worldClock.setMode('event', { time: event.utcStart });
    moduleState.set('astroeye', {
      version: 1,
      selectedEventId: event.id,
      selectedChartId: chart.chartId,
      houseSystem: chart.options.houseSystem,
    });
    moduleState.setActiveModule('astroeye');
    await presentEvent(event, chart);
    eventBus.emit('astroeye:event-selected', { eventId: event.id, chartId: chart.chartId });
    return Object.freeze({ event, chart });
  }

  return Object.freeze({
    async saveDraft(draft) {
      const event = eventFromDraft(draft, idFactory);
      const chart = calculateAstroEyeChart(event, { houseSystem: draft.houseSystem || 'whole-sign' });
      const saved = await recordStore.saveEventWithChart(event, chart);
      eventBus.emit('astroeye:event-saved', { eventId: event.id, chartId: chart.chartId });
      return activate(saved.event, saved.chart);
    },
    async selectEvent(eventId, { houseSystem = 'whole-sign' } = {}) {
      const event = await recordStore.getEvent(eventId);
      if (!event) throw new Error(`Unknown AstroEye event: ${eventId}`);
      const charts = await recordStore.listCharts({ eventId });
      let chart = charts.find((entry) => entry.options?.houseSystem === houseSystem);
      if (!chart) chart = await recordStore.saveChart(calculateAstroEyeChart(event, { houseSystem }));
      return activate(event, chart);
    },
    async deleteEvent(eventId) {
      const removed = await recordStore.deleteEvent(eventId);
      const selected = moduleState.get('astroeye');
      if (removed && selected?.selectedEventId === eventId) {
        moduleState.clear('astroeye');
        moduleState.setActiveModule(null);
        worldClock.setMode('live');
        await presentEvent(null, null);
      }
      if (removed) eventBus.emit('astroeye:event-deleted', { eventId });
      return removed;
    },
    listEvents() {
      return recordStore.listEvents();
    },
    serializeRecords() {
      return recordStore.serializeRecords();
    },
    async importRecords(input, options) {
      const result = await recordStore.importRecords(input, options);
      eventBus.emit('astroeye:records-imported', result);
      return result;
    },
    selectedState() {
      return moduleState.get('astroeye');
    },
  });
}
