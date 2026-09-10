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

test('time previews update chart and shared time without modifying any saved records', async () => {
  const context = harness();
  const original = await context.controller.saveDraft(DRAFT);
  const before = await context.controller.serializeRecords();
  const notifications = [];
  context.eventBus.on('astroeye:time-preview', (payload) => notifications.push(payload));
  const preview = context.controller.previewTime(90);
  assert.deepEqual(preview.event, original.event);
  assert.equal(preview.chart.calculatedFor, '2026-09-10T01:45:00.000Z');
  assert.notEqual(preview.chart.houses.angles.ascendant, original.chart.houses.angles.ascendant);
  assert.equal(context.worldClock.mode, 'replay');
  assert.equal(context.worldClock.now().toISOString(), preview.chart.calculatedFor);
  assert.equal(context.controller.selectedState().selectedChartId, original.chart.chartId);
  assert.deepEqual(context.controller.selectedState().preview, { offsetMinutes: 90, calculatedFor: preview.chart.calculatedFor });
  assert.equal(notifications.length, 1);
  assert.equal(context.presented.length, 1, 'scrubbing must not move the camera');
  await context.controller.refocusSelected();
  assert.equal(context.worldClock.mode, 'replay', 'refocusing must preserve preview time');
  assert.equal(context.presented.at(-1).event.utcStart, original.event.utcStart, 'marker keeps the source schedule');
  assert.equal(await context.controller.serializeRecords(), before);
  const restored = context.controller.previewTime(0);
  assert.deepEqual(restored.chart, original.chart);
  assert.equal(context.worldClock.mode, 'event');
  assert.equal(context.controller.selectedState().preview, undefined);
  assert.equal(await context.controller.serializeRecords(), before);
  await context.recordStore.close();
});

test('preview offsets are absolute from kickoff, bounded and validated before changing state', async () => {
  const context = harness();
  assert.throws(() => context.controller.previewTime(15), /Choose a saved event/);
  await context.controller.saveDraft(DRAFT);
  context.controller.previewTime(360);
  const preview = context.controller.previewTime(-360);
  assert.equal(preview.chart.calculatedFor, '2026-09-09T18:15:00.000Z');
  const before = context.worldClock.snapshot();
  for (const offset of [361, -361, NaN, Infinity, 1.5, '15', null, undefined]) {
    assert.throws(() => context.controller.previewTime(offset), /whole-minute/);
    assert.deepEqual(context.worldClock.snapshot(), before);
  }
  await context.recordStore.close();
});

test('selection resets preview, preserves house system and deletion clears its source', async () => {
  const context = harness();
  await context.controller.saveDraft({ ...DRAFT, houseSystem: 'equal' });
  assert.equal(context.controller.previewTime(15).chart.options.houseSystem, 'equal');
  await context.controller.selectEvent('event-generated', { houseSystem: 'equal' });
  assert.equal(context.worldClock.mode, 'event');
  assert.equal(context.controller.selectedState().preview, undefined);
  context.controller.previewTime(-15);
  await context.controller.deleteEvent('event-generated');
  assert.equal(context.worldClock.mode, 'live');
  assert.throws(() => context.controller.previewTime(15), /Choose a saved event/);
  await assert.rejects(context.controller.refocusSelected(), /Choose a saved event/);
  await context.recordStore.close();
});

test('UTC offsets correctly traverse both occurrences of a repeated local hour', async () => {
  const context = harness();
  const original = await context.controller.saveDraft({ ...DRAFT, localDate: '2026-11-01', localTime: '01:30', utcStart: '2026-11-01T06:30:00.000Z' });
  const preview = context.controller.previewTime(-60);
  assert.equal(preview.chart.calculatedFor, '2026-11-01T05:30:00.000Z');
  assert.equal(preview.event.utcStart, original.event.utcStart);
  assert.equal(preview.event.scheduledLocal.time, '01:30:00');
  assert.deepEqual(context.controller.previewTime(0).chart, original.chart);
  await context.recordStore.close();
});

test('UTC offsets cross the spring clock gap and midnight without nonexistent local times', async () => {
  const context = harness();
  await context.controller.saveDraft({ ...DRAFT, localDate: '2026-03-08', localTime: '01:45' });
  assert.equal(context.controller.previewTime(30).chart.calculatedFor, '2026-03-08T07:15:00.000Z');
  assert.equal(context.controller.previewTime(-360).chart.calculatedFor, '2026-03-08T00:45:00.000Z');
  await context.recordStore.close();
});
