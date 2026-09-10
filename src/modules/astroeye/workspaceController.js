import { normalizeEvent } from '../../domain/events/eventSchema.js';
import { calculateAstroEyeChart } from './calculation/chart.js';
import { calculateTimePreview } from './timeExplorer.js';
import { createSharedView, normalizeSharedView } from './shareView.js';

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

  let activeSelection = null;

  function applySelectionTime(chart, offsetMinutes) {
    const { event, chart: originalChart, isShared } = activeSelection;
    worldClock.setMode(offsetMinutes === 0 ? 'event' : 'replay', { time: chart.calculatedFor });
    moduleState.set('astroeye', {
      version: 1, selectedEventId: event.id, selectedChartId: isShared ? null : originalChart.chartId,
      houseSystem: chart.options.houseSystem,
      ...(isShared ? { shared: true } : {}),
      ...(offsetMinutes === 0 ? {} : { preview: { offsetMinutes, calculatedFor: chart.calculatedFor } }),
    });
  }

  async function activate(event, chart, { isShared = false, offsetMinutes = 0, navigate = true } = {}) {
    const displayedChart = offsetMinutes === 0 ? chart : calculateTimePreview(event, offsetMinutes, { houseSystem: chart.options.houseSystem });
    // Validate and calculate everything before presentation or shared-state mutation.
    await presentEvent(event, chart, { navigate });
    activeSelection = Object.freeze({ event, chart, isShared });
    applySelectionTime(displayedChart, offsetMinutes);
    moduleState.setActiveModule('astroeye');
    eventBus.emit('astroeye:event-selected', { eventId: event.id, chartId: chart.chartId });
    return Object.freeze({ event, chart: displayedChart, offsetMinutes, isShared });
  }

  return Object.freeze({
    shareSnapshot() {
      if (!activeSelection) throw new Error('Choose an event before creating a view link.');
      return createSharedView(activeSelection.event, {
        houseSystem: activeSelection.chart.options.houseSystem,
        offsetMinutes: moduleState.get('astroeye')?.preview?.offsetMinutes ?? 0,
      });
    },
    async restoreSharedView(input) {
      const snapshot = normalizeSharedView(input);
      const chart = calculateAstroEyeChart(snapshot.event, { houseSystem: snapshot.houseSystem });
      // No IndexedDB writes and no camera move: the shell owns the shared camera pose.
      return activate(snapshot.event, chart, { isShared: true, offsetMinutes: snapshot.offsetMinutes, navigate: false });
    },
    async saveSharedCopy() {
      if (!activeSelection?.isShared) throw new Error('No unsaved shared event is selected.');
      const offsetMinutes = moduleState.get('astroeye')?.preview?.offsetMinutes ?? 0;
      const id = idFactory();
      if (id === activeSelection.event.id || await recordStore.getEvent(id)) throw new Error('Could not allocate a new event ID. No records were changed.');
      const event = normalizeEvent({ ...activeSelection.event, id });
      const chart = calculateAstroEyeChart(event, { houseSystem: activeSelection.chart.options.houseSystem });
      const saved = await recordStore.saveEventWithChart(event, chart);
      eventBus.emit('astroeye:event-saved', { eventId: event.id, chartId: chart.chartId });
      return activate(saved.event, saved.chart, { offsetMinutes, navigate: false });
    },
    previewTime(offsetMinutes) {
      if (!activeSelection) throw new Error('Choose a saved event before exploring time.');
      const { event, chart: savedChart } = activeSelection;
      const chart = offsetMinutes === 0 ? savedChart : calculateTimePreview(event, offsetMinutes, {
        houseSystem: savedChart.options.houseSystem,
      });
      applySelectionTime(chart, offsetMinutes);
      eventBus.emit('astroeye:time-preview', { eventId: event.id, offsetMinutes, calculatedFor: chart.calculatedFor });
      return Object.freeze({ event, chart, offsetMinutes, isShared: activeSelection.isShared });
    },
    async refocusSelected() {
      if (!activeSelection) throw new Error('Choose a saved event before viewing its venue.');
      return presentEvent(activeSelection.event, activeSelection.chart);
    },
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
      let chart = charts.find((entry) => entry.options?.houseSystem === houseSystem && entry.calculatedFor === event.utcStart);
      if (!chart) chart = await recordStore.saveChart(calculateAstroEyeChart(event, { houseSystem }));
      return activate(event, chart);
    },
    async deleteEvent(eventId) {
      const removed = await recordStore.deleteEvent(eventId);
      const selected = moduleState.get('astroeye');
      if (removed && selected?.selectedEventId === eventId) {
        activeSelection = null;
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
