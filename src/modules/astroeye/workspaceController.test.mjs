import assert from 'node:assert/strict';
import test from 'node:test';

import { indexedDB } from 'fake-indexeddb';

import { EventBus } from '../../core/eventBus.js';
import { ModuleStateCoordinator } from '../../core/moduleState.js';
import { WorldClock } from '../../core/worldClock.js';
import { createWorldRecordStore } from '../../core/worldRecordStore.js';
import { createAstroEyeWorkspaceController, eventFromDraft } from './workspaceController.js';

const DRAFT = {
  title: 'Away Team at Home Team',
  sport: 'American Football',
  competition: 'NFL',
  home: 'Home Team',
  away: 'Away Team',
  localDate: '2026-09-09',
  localTime: '20:15',
  timeZone: 'America/New_York',
  venueName: 'Example Stadium',
  latitude: 40.7505,
  longitude: -73.9934,
  houseSystem: 'whole-sign',
};

let sequence = 0;
function harness() {
  sequence += 1;
  const eventBus = new EventBus();
  const moduleState = new ModuleStateCoordinator({ eventBus });
  const worldClock = new WorldClock({ now: () => Date.parse('2026-01-01T00:00:00Z'), eventBus });
  const recordStore = createWorldRecordStore({ indexedDB, databaseName: `astroeye-workspace-${sequence}` });
  const presented = [];
  const controller = createAstroEyeWorkspaceController({
    recordStore,
    worldClock,
    moduleState,
    eventBus,
    presentEvent: async (event, chart) => presented.push({ event, chart }),
    idFactory: () => 'event-generated',
  });
  return { controller, eventBus, moduleState, worldClock, recordStore, presented };
}

test('manual drafts become canonical events without exposing storage IDs in the form', () => {
  const event = eventFromDraft(DRAFT, () => 'event-generated');
  assert.equal(event.id, 'event-generated');
  assert.equal(event.utcStart, '2026-09-10T00:15:00.000Z');
  assert.equal(event.source.kind, 'manual');
});

test('manual drafts can resolve a repeated daylight-saving hour explicitly', () => {
  const event = eventFromDraft({
    ...DRAFT,
    localDate: '2026-11-01',
    localTime: '01:30',
    utcStart: '2026-11-01T06:30:00.000Z',
  }, () => 'fold-event');
  assert.equal(event.utcStart, '2026-11-01T06:30:00.000Z');
});

test('saving a draft persists one chart and synchronizes shared world state', async () => {
  const context = harness();
  const selected = await context.controller.saveDraft(DRAFT);
  assert.equal(selected.event.id, 'event-generated');
  assert.equal(selected.chart.options.houseSystem, 'whole-sign');
  assert.equal(context.worldClock.mode, 'event');
  assert.equal(context.worldClock.now().toISOString(), selected.event.utcStart);
  assert.equal(context.moduleState.activeModuleId, 'astroeye');
  assert.deepEqual(context.controller.selectedState(), {
    version: 1,
    selectedEventId: selected.event.id,
    selectedChartId: selected.chart.chartId,
    houseSystem: 'whole-sign',
  });
  assert.equal(context.presented.length, 1);
  await context.recordStore.close();
});

test('selecting another house system calculates it once and reuses it', async () => {
  const context = harness();
  await context.controller.saveDraft(DRAFT);
  const equal = await context.controller.selectEvent('event-generated', { houseSystem: 'equal' });
  assert.equal(equal.chart.options.houseSystem, 'equal');
  await context.controller.selectEvent('event-generated', { houseSystem: 'equal' });
  assert.equal((await context.recordStore.listCharts({ eventId: 'event-generated' })).length, 2);
  await context.recordStore.close();
});

test('deleting the selected event restores live time and clears presentation', async () => {
  const context = harness();
  await context.controller.saveDraft(DRAFT);
  assert.equal(await context.controller.deleteEvent('event-generated'), true);
  assert.equal(context.worldClock.mode, 'live');
  assert.equal(context.moduleState.get('astroeye'), null);
  assert.deepEqual(context.presented.at(-1), { event: null, chart: null });
  await context.recordStore.close();
});
