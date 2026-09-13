import assert from 'node:assert/strict';
import test from 'node:test';
import { indexedDB } from 'fake-indexeddb';
import { createWorldRecordStore } from '../../core/worldRecordStore.js';
import { EventBus } from '../../core/eventBus.js';
import { ModuleStateCoordinator } from '../../core/moduleState.js';
import { WorldClock } from '../../core/worldClock.js';
import { createAstroEyeWorkspaceController, eventFromDraft } from './workspaceController.js';
import { calculateAstroEyeChart } from './calculation/chart.js';
import { ASTROEYE_DATE_RANGE, savedChartDateNotice } from './calculation/dateRange.js';
import { calculateTimePreview } from './timeExplorer.js';
import { createSharedView, normalizeSharedView } from './shareView.js';
import { describeDraftTime } from './draftTimeSummary.js';

const draft = { id: 'date-range', title: 'Synthetic range check', sport: 'Demo', competition: 'QA',
  home: 'A', away: 'B', localDate: '2000-01-01', localTime: '12:00', timeZone: 'UTC',
  venueName: 'Synthetic', latitude: 40, longitude: -75 };
const eventAt = (date, time = '00:00:00') => eventFromDraft({ ...draft, localDate: date, localTime: time });

test('approved 1900–2100 range applies to every calculation model and shared preview input', () => {
  assert.equal(ASTROEYE_DATE_RANGE.startInclusive, '1900-01-01T00:00:00.000Z');
  assert.equal(ASTROEYE_DATE_RANGE.endExclusive, '2101-01-01T00:00:00.000Z');
  for (const [date, time] of [['1900-01-01', '00:00:00'], ['2100-12-31', '23:59:59']]) {
    const event = eventAt(date, time);
    for (const calculationVersion of [1, 2, 3]) {
      assert.equal(calculateAstroEyeChart(event, { calculationVersion }).calculatedFor, event.utcStart);
      assert.equal(createSharedView(event, { calculationVersion }).event.utcStart, event.utcStart);
    }
  }
  for (const date of ['1899-12-31', '2101-01-01']) {
    const event = eventAt(date);
    for (const calculationVersion of [1, 2, 3]) {
      assert.throws(() => calculateAstroEyeChart(event, { calculationVersion }), /outside 1900–2100 UTC/);
      assert.throws(() => createSharedView(event, { calculationVersion }), /outside 1900–2100 UTC/);
      assert.throws(() => calculateTimePreview(event, 0, { calculationVersion }), /outside 1900–2100 UTC/);
    }
  }
});

test('preview and link guards enforce both event and displayed time at UTC boundaries', () => {
  for (const [event, offset] of [[eventAt('1900-01-01'), -1], [eventAt('2100-12-31', '23:59:00'), 1]]) {
    assert.throws(() => calculateTimePreview(event, offset), /outside 1900–2100 UTC/);
    assert.throws(() => createSharedView(event, { offsetMinutes: offset }), /outside 1900–2100 UTC/);
    const shared = createSharedView(event);
    assert.throws(() => normalizeSharedView({ ...shared, offsetMinutes: offset }), /outside 1900–2100 UTC/);
    assert.equal(calculateTimePreview(event, -offset).calculationVersion, 3);
  }
});

test('draft notices follow resolved UTC, do not guess folds and do not claim accuracy', () => {
  const out = describeDraftTime({ localDate: '2100-12-31', localTime: '23:30', timeZone: 'America/New_York' });
  assert.equal(out.state, 'out-of-range');
  assert.equal(out.utcStart, '2101-01-01T04:30:00.000Z');
  const inside = describeDraftTime({ localDate: '2101-01-01', localTime: '00:30', timeZone: 'Pacific/Kiritimati' });
  assert.equal(inside.state, 'ready');
  assert.equal(inside.utcStart, '2100-12-31T10:30:00.000Z');
  assert.equal(describeDraftTime({ localDate: '2026-11-01', localTime: '01:30', timeZone: 'America/New_York' }).state, 'ambiguous');
  assert.match(savedChartDateNotice({ calculatedFor: out.utcStart }), /Stored values are unchanged/);
  assert.equal(savedChartDateNotice({ calculatedFor: inside.utcStart }), '');
});

test('rejected saves and previews leave records, selection and world time unchanged; archival records survive', async () => {
  const eventBus = new EventBus(), recordStore = createWorldRecordStore({ indexedDB, databaseName: 'date-range-integration' });
  const worldClock = new WorldClock({ eventBus }), moduleState = new ModuleStateCoordinator({ eventBus });
  const controller = createAstroEyeWorkspaceController({ eventBus, recordStore, worldClock, moduleState });
  try {
    await controller.saveDraft({ ...draft, localDate: '1900-01-01', localTime: '00:00' });
    const before = await recordStore.serializeRecords(), selection = controller.selectionSnapshot();
    const clock = worldClock.now().toISOString(), state = moduleState.get('astroeye');
    await assert.rejects(controller.saveDraft({ ...draft, id: 'invalid', localDate: '1899-12-31' }), /outside 1900–2100 UTC/);
    assert.throws(() => controller.previewTime(-1), /outside 1900–2100 UTC/);
    assert.equal(await recordStore.serializeRecords(), before);
    assert.deepEqual(controller.selectionSnapshot(), selection);
    assert.equal(worldClock.now().toISOString(), clock);
    assert.deepEqual(moduleState.get('astroeye'), state);
    // Synthetic archival payload: test storage/selection, not numerical accuracy.
    const oldEvent = eventAt('1899-12-31');
    const oldChart = { ...structuredClone(selection.chart), chartId: 'synthetic-archive', calculatedFor: oldEvent.utcStart };
    await recordStore.saveEventWithChart(oldEvent, oldChart);
    const archive = await recordStore.serializeRecords();
    const selected = await controller.selectEvent(oldEvent.id, { navigate: false });
    assert.deepEqual(selected.chart, oldChart);
    assert.deepEqual(controller.previewTime(0).chart, oldChart);
    assert.throws(() => controller.previewTime(1), /outside 1900–2100 UTC/);
    assert.throws(() => controller.shareSnapshot(), /outside 1900–2100 UTC/);
    await assert.rejects(controller.selectEvent(oldEvent.id, { houseSystem: 'equal' }), /outside 1900–2100 UTC/);
    assert.equal(await recordStore.serializeRecords(), archive);
    await recordStore.importRecords(archive, { mode: 'replace' });
    assert.equal(await recordStore.serializeRecords(), archive);
  } finally { await recordStore.close(); }
});
