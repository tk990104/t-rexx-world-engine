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

test('matching export round-trips only saved matching events and charts without changing selection or records', async () => {
  const context = harness();
  const target = createWorldRecordStore({ indexedDB, databaseName: 'matching-export-roundtrip' });
  try {
    await context.controller.saveDraft({ ...DRAFT, id: 'keep', title: 'Keep event' });
    await context.controller.saveDraft({ ...DRAFT, id: 'private', title: 'Private event' });
    await context.recordStore.saveWorkspace({ id: 'private-research', eventIds: ['keep', 'private'] });
    context.controller.previewTime(15);
    const selection = context.controller.selectionSnapshot();
    const before = await context.controller.serializeRecords();
    const json = await context.controller.serializeMatchingRecords({ query: 'Keep' });
    assert.deepEqual(await target.importRecords(json), { mode: 'merge', events: 1, charts: 1, workspaces: 0 });
    assert.equal((await target.listEvents())[0].id, 'keep');
    assert.equal((await target.listCharts())[0].eventId, 'keep');
    assert.equal(await context.controller.serializeRecords(), before);
    assert.deepEqual(context.controller.selectionSnapshot(), selection);
    await assert.rejects(context.controller.serializeMatchingRecords({ query: 'missing' }), /Nothing was exported/);
    await assert.rejects(context.controller.serializeMatchingRecords({ dateFrom: '2026-09-10', dateTo: '2026-09-09' }), /date/i);
  } finally { await context.recordStore.close(); await target.close(); }
});

test('matching export freezes caller filters before a delayed storage response', async () => {
  const context = harness();
  try {
    await context.controller.saveDraft({ ...DRAFT, title: 'Keep event' });
    let release;
    const delayed = createAstroEyeWorkspaceController({ ...context, recordStore: { ...context.recordStore,
      serializeRecords: () => new Promise((resolve) => { release = resolve; }) } });
    const filters = { query: 'Keep' };
    const pending = delayed.serializeMatchingRecords(filters);
    filters.query = 'missing';
    release(await context.controller.serializeRecords());
    assert.equal(JSON.parse(await pending).events.length, 1);
  } finally { await context.recordStore.close(); }
});

test('map selection can calculate a missing house chart without writes or camera navigation', async () => {
  const context = harness();
  try {
    await context.controller.saveDraft(DRAFT);
    const before = await context.recordStore.serializeRecords();
    let presentedOptions;
    const reader = createAstroEyeWorkspaceController({ ...context, presentEvent: async (_event, _chart, options) => { presentedOptions = options; } });
    const result = await reader.selectEvent('event-generated', { houseSystem: 'equal', navigate: false, persistChart: false });
    assert.equal(result.chart.options.houseSystem, 'equal');
    assert.equal(presentedOptions.navigate, false);
    assert.equal(reader.selectedState().selectedChartId, null, 'transient chart must not claim a durable chart ID');
    assert.equal(await context.recordStore.serializeRecords(), before);
    assert.equal(await reader.selectEvent('event-generated', { isCurrent: () => false, persistChart: false }), null);
    assert.equal(reader.selectionSnapshot().chart.options.houseSystem, 'equal');
  } finally { await context.recordStore.close(); }
});

let sequence = 0;

test('selection snapshots expose the committed preview before notifications and never share mutable records', async () => {
  const context = harness();
  try {
    assert.equal(context.controller.selectionSnapshot(), null);
    let seen;
    context.eventBus.on('astroeye:event-selected', () => { seen = context.controller.selectionSnapshot(); });
    await context.controller.saveDraft(DRAFT);
    assert.equal(seen.event.id, 'event-generated');
    const before = await context.recordStore.serializeRecords();
    context.eventBus.on('astroeye:time-preview', () => { seen = context.controller.selectionSnapshot(); });
    context.controller.previewTime(15);
    assert.equal(seen.offsetMinutes, 15);
    assert.equal(seen.chart.calculatedFor, '2026-09-10T00:30:00.000Z');
    seen.event.title = 'mutated';
    seen.chart.positions[0].longitude = 999;
    assert.equal(context.controller.selectionSnapshot().event.title, DRAFT.title);
    assert.notEqual(context.controller.selectionSnapshot().chart.positions[0].longitude, 999);
    assert.equal(await context.recordStore.serializeRecords(), before);
    await context.controller.deleteEvent('event-generated');
    assert.equal(context.controller.selectionSnapshot(), null);
  } finally { await context.recordStore.close(); }
});

test('cancelled scene restoration cannot update selection or world time after an await', async () => {
  let release, entered, current = true;
  const ready = new Promise((resolve) => { entered = resolve; });
  const context = harness({ presentEvent: async (_event, _chart, options) => {
    assert.equal(options.navigate, false);
    entered(); await new Promise((resolve) => { release = resolve; });
  } });
  const event = eventFromDraft(DRAFT, () => 'scene-event');
  const { createSharedView } = await import('./shareView.js');
  try {
    const before = context.worldClock.now().toISOString();
    const task = context.controller.restoreSharedView(createSharedView(event), { isCurrent: () => current });
    await ready; current = false; release();
    assert.equal(await task, null);
    assert.equal(context.worldClock.now().toISOString(), before);
    assert.equal(context.controller.selectedState(), null);
    assert.deepEqual(await context.recordStore.listEvents(), []);
  } finally { await context.recordStore.close(); }
});
function harness({ idFactory = () => 'event-generated', presentEvent } = {}) {
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
    presentEvent: presentEvent ?? (async (event, chart) => presented.push({ event, chart })),
    idFactory,
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

test('shared view opens without writes, matches the original chart and saves only an explicit new copy', async () => {
  let id = 0;
  const sender = harness();
  await sender.controller.saveDraft({ ...DRAFT, houseSystem: 'equal' });
  const expected = sender.controller.previewTime(-45);
  const recipient = harness({ idFactory: () => `local-copy-${++id}` });
  // A local record with the incoming ID must survive the shared preview and save-copy.
  const local = await recipient.controller.saveDraft({ ...DRAFT, id: expected.event.id, title: 'Existing local event' });
  const before = await recipient.controller.serializeRecords();
  const snapshot = sender.controller.shareSnapshot();
  const restored = await recipient.controller.restoreSharedView(snapshot);
  assert.deepEqual(restored.chart, expected.chart);
  assert.equal(restored.isShared, true);
  assert.equal(recipient.worldClock.now().toISOString(), expected.chart.calculatedFor);
  assert.equal(recipient.controller.selectedState().selectedChartId, null);
  assert.equal(recipient.controller.selectedState().shared, true);
  assert.equal(await recipient.controller.serializeRecords(), before);
  recipient.controller.previewTime(15);
  assert.equal(recipient.controller.previewTime(-45).isShared, true);
  const saved = await recipient.controller.saveSharedCopy();
  assert.equal(saved.isShared, false);
  assert.notEqual(saved.event.id, snapshot.event.id);
  assert.equal(saved.offsetMinutes, -45);
  assert.equal(saved.chart.calculatedFor, expected.chart.calculatedFor);
  assert.deepEqual(await recipient.recordStore.getEvent(local.event.id), local.event);
  assert.equal((await recipient.recordStore.listCharts({ eventId: saved.event.id })).length, 1);
  assert.equal((await recipient.recordStore.listCharts({ eventId: saved.event.id }))[0].calculatedFor, saved.event.utcStart);
  await assert.rejects(recipient.controller.saveSharedCopy(), /No unsaved shared event/);
  await sender.recordStore.close(); await recipient.recordStore.close();
});

test('invalid shared state leaves current selection, time, records and presentation unchanged', async () => {
  const context = harness();
  await context.controller.saveDraft(DRAFT);
  const before = await context.controller.serializeRecords();
  const clock = context.worldClock.snapshot();
  const state = context.controller.selectedState();
  const snapshot = context.controller.shareSnapshot();
  await assert.rejects(context.controller.restoreSharedView({ ...snapshot, offsetMinutes: 500 }), /outside/);
  assert.deepEqual(context.controller.selectedState(), state);
  assert.deepEqual(context.worldClock.snapshot(), clock);
  assert.equal(await context.controller.serializeRecords(), before);
  assert.equal(context.presented.length, 1);
  await context.recordStore.close();
});

test('shared view presentation failure does not claim a successful module or clock restore', async () => {
  const sender = harness();
  await sender.controller.saveDraft(DRAFT);
  const recipient = harness({ presentEvent: async () => { throw new Error('renderer unavailable'); } });
  await assert.rejects(recipient.controller.restoreSharedView(sender.controller.shareSnapshot()), /renderer unavailable/);
  assert.equal(recipient.worldClock.mode, 'live');
  assert.equal(recipient.controller.selectedState(), null);
  assert.equal((await recipient.controller.listEvents()).length, 0);
  await sender.recordStore.close(); await recipient.recordStore.close();
});

test('save-copy refuses a colliding generated ID instead of overwriting an event', async () => {
  const context = harness();
  await context.controller.saveDraft(DRAFT);
  const snapshot = context.controller.shareSnapshot();
  const before = await context.controller.serializeRecords();
  await context.controller.restoreSharedView(snapshot);
  await assert.rejects(context.controller.saveSharedCopy(), /new event ID/);
  assert.equal(await context.controller.serializeRecords(), before);
  await context.recordStore.close();
});
