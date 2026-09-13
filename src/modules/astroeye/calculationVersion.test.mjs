import assert from 'node:assert/strict';
import test from 'node:test';
import { indexedDB } from 'fake-indexeddb';
import { createWorldRecordStore } from '../../core/worldRecordStore.js';
import { EventBus } from '../../core/eventBus.js';
import { ModuleStateCoordinator } from '../../core/moduleState.js';
import { WorldClock } from '../../core/worldClock.js';
import { createAstroEyeWorkspaceController, eventFromDraft } from './workspaceController.js';
import { calculateAstroEyeChart } from './calculation/chart.js';
import { chartCalculationVersion } from './calculation/modelVersion.js';
import { calculateTimePreview } from './timeExplorer.js';
import { captureComparison, compareCharts } from './chartComparison.js';
import { compareCrossChartAspects } from './crossChartAspects.js';
import { serializeComparisonReport } from './comparisonReport.js';
import { createNotebookChartReference } from './notebookChartReference.js';
import { createSharedView } from './shareView.js';
import { createAstroEyeTour } from './directorRecipe.js';
import * as Astronomy from 'astronomy-engine';

const draft = { id: 'version-test', title: 'Synthetic version test', sport: 'Demo', competition: 'QA', home: 'A', away: 'B',
  localDate: '2026-09-13', localTime: '12:00', timeZone: 'UTC', venueName: 'Synthetic', latitude: 40, longitude: -75 };
const event = eventFromDraft(draft);
let nextDatabase = 0;
async function setup() {
  const eventBus = new EventBus();
  const recordStore = createWorldRecordStore({ indexedDB, databaseName: `calculation-version-${++nextDatabase}` });
  const moduleState = new ModuleStateCoordinator({ eventBus }), worldClock = new WorldClock({ eventBus });
  const presented = [];
  const controller = createAstroEyeWorkspaceController({ recordStore, eventBus, moduleState, worldClock,
    presentEvent: async (...args) => { presented.push(args); } });
  await recordStore.saveEventWithChart(event, calculateAstroEyeChart(event, { calculationVersion: 1 }));
  const saved = await controller.selectEvent(event.id);
  return { recordStore, controller, saved, moduleState, worldClock, presented };
}

test('new charts default to model 2 with a distinct identity while explicit v1 remains available', () => {
  const chart = calculateAstroEyeChart(event, { calculationVersion: 1 });
  const modern = calculateAstroEyeChart(event);
  assert.equal(modern.calculationVersion, 2);
  assert.equal(modern.chartId, chart.chartId + ':model-2');
  assert.equal(chart.calculationVersion, 1);
  assert.equal(chart.chartId, `astroeye:${event.id}:${event.utcStart}:tropical-geocentric:whole-sign`);
  assert.equal(calculateTimePreview(event, 15, { calculationVersion: 1 }).calculationVersion, 1);
  for (const calculationVersion of [3, null, '1', 0]) {
    assert.throws(() => calculateAstroEyeChart(event, { calculationVersion }), /calculation version/);
    assert.throws(() => calculateTimePreview(event, 15, { calculationVersion }), /calculation version/);
  }
  assert.equal(chartCalculationVersion({}), 1);
  for (const calculationVersion of [null, '1', 0, -1, 1.5, Infinity]) {
    assert.throws(() => chartCalculationVersion({ calculationVersion }), /calculation version/);
  }
});

test('legacy untagged charts remain byte-unchanged through selection, preview and share creation', async () => {
  const ctx = await setup();
  try {
    const legacy = structuredClone(ctx.saved.chart); delete legacy.calculationVersion;
    await ctx.recordStore.saveChart(legacy);
    const before = await ctx.recordStore.serializeRecords();
    const selected = await ctx.controller.selectEvent(event.id, { navigate: false });
    assert.equal(selected.chart.calculationVersion, undefined);
    assert.equal(ctx.controller.previewTime(15).chart.calculationVersion, 1);
    const share = ctx.controller.shareSnapshot();
    assert.equal(share.calculationVersion, 1);
    assert.equal(createAstroEyeTour(share, { id: 'version-tour' }).shots[0].modules.astroeye.calculationVersion, 1);
    assert.deepEqual(ctx.controller.previewTime(0).chart, legacy);
    assert.equal(await ctx.recordStore.serializeRecords(), before);
  } finally { await ctx.recordStore.close(); }
});

test('unsupported matching cache records cannot overwrite storage or change current selection', async () => {
  const ctx = await setup();
  try {
    const beforeView = ctx.controller.selectionSnapshot(), beforeState = ctx.moduleState.get('astroeye');
    const beforeTime = ctx.worldClock.now().toISOString(), presentations = ctx.presented.length;
    for (const mutate of [
      (chart) => { chart.calculationVersion = 3; },
      (chart) => { chart.calculationVersion = null; },
      (chart) => { chart.engine.version = 'future'; },
      (chart) => { chart.engine.id = 'other'; },
      (chart) => { chart.options.referenceFrame = 'other'; },
    ]) {
      const unsupported = structuredClone(ctx.saved.chart); mutate(unsupported);
      await ctx.recordStore.saveChart(unsupported);
      const before = await ctx.recordStore.serializeRecords();
      await assert.rejects(ctx.controller.selectEvent(event.id), /unsupported.*unchanged/);
      assert.equal(await ctx.recordStore.serializeRecords(), before);
      assert.deepEqual(ctx.controller.selectionSnapshot(), beforeView);
      assert.deepEqual(ctx.moduleState.get('astroeye'), beforeState);
      assert.equal(ctx.worldClock.now().toISOString(), beforeTime);
      assert.equal(ctx.presented.length, presentations);
    }
  } finally { await ctx.recordStore.close(); }
});

test('supported cache entry is chosen even when an unsupported entry has the same time and house system', async () => {
  const ctx = await setup();
  try {
    await ctx.recordStore.saveChart({ ...ctx.saved.chart, chartId: '000-future', calculationVersion: 3 });
    const before = await ctx.recordStore.serializeRecords();
    assert.equal((await ctx.controller.selectEvent(event.id)).chart.chartId, ctx.saved.chart.chartId);
    assert.equal(await ctx.recordStore.serializeRecords(), before);
  } finally { await ctx.recordStore.close(); }
});

test('model mismatches suppress comparisons, cross-aspects and reports; labels preserve model provenance', () => {
  const chart = calculateAstroEyeChart(event, { calculationVersion: 1 }), pin = captureComparison(event, chart);
  assert.equal(pin.calculationVersion, 1);
  for (const calculationVersion of [2, null]) {
    const future = { ...pin, calculationVersion };
    assert.deepEqual(compareCharts(pin, future).rows, []);
    assert.deepEqual(compareCrossChartAspects(pin, future).rows, []);
    assert.throws(() => serializeComparisonReport(pin, future), /model versions/);
  }
  const legacy = { ...pin }; delete legacy.calculationVersion;
  assert.equal(compareCharts(pin, legacy).rows.length, 12);
  assert.match(serializeComparisonReport(pin, legacy), /Calculation model: 1/);
  assert.match(createNotebookChartReference(event, chart), /Calculation model: 1/);
});

test('future share and tour versions refuse restoration before any writes or state changes', async () => {
  const ctx = await setup();
  try {
    const before = await ctx.recordStore.serializeRecords(), selected = ctx.controller.selectionSnapshot();
    const share = ctx.controller.shareSnapshot();
    assert.throws(() => createSharedView(event, { calculationVersion: 3 }), /version/);
    assert.throws(() => createAstroEyeTour({ ...share, calculationVersion: 3 }), /version/);
    await assert.rejects(ctx.controller.restoreSharedView({ ...share, calculationVersion: 3 }), /version/);
    assert.equal(await ctx.recordStore.serializeRecords(), before);
    assert.deepEqual(ctx.controller.selectionSnapshot(), selected);
  } finally { await ctx.recordStore.close(); }
});

test('both model links and tours replay their own math without writes, including time previews', async () => {
  const ctx = await setup();
  try {
    const before = await ctx.recordStore.serializeRecords();
    for (const calculationVersion of [1, 2]) {
      const share = createSharedView(event, { calculationVersion, offsetMinutes: 15 });
      const tour = createAstroEyeTour(share, { id: 'two-model-tour' });
      assert.equal(tour.shots[0].modules.astroeye.calculationVersion, calculationVersion);
      await ctx.controller.restoreSharedView(share);
      const preview = ctx.controller.previewTime(30);
      assert.equal(preview.chart.calculationVersion, calculationVersion);
      assert.equal(ctx.controller.shareSnapshot().calculationVersion, calculationVersion);
      assert.deepEqual(preview.chart, calculateTimePreview(event, 30, { calculationVersion }));
      assert.equal(ctx.controller.previewTime(0).chart.calculationVersion, calculationVersion);
    }
    assert.equal(await ctx.recordStore.serializeRecords(), before);
  } finally { await ctx.recordStore.close(); }
});

test('new model saves have distinct cache identities and leave old chart bytes intact', async () => {
  const ctx = await setup();
  try {
    const original = JSON.stringify(ctx.saved.chart);
    const modern = calculateAstroEyeChart(event);
    await ctx.recordStore.saveChart(modern);
    const charts = await ctx.recordStore.listCharts({ eventId: event.id });
    assert.equal(charts.length, 2);
    assert.equal(JSON.stringify(charts.find((chart) => chart.chartId === ctx.saved.chart.chartId)), original);
    const newSelection = await ctx.controller.saveDraft({ ...draft, id: 'new-model-event' });
    assert.equal(newSelection.chart.calculationVersion, 2);
    assert.equal(ctx.controller.previewTime(15).chart.calculationVersion, 2);
  } finally { await ctx.recordStore.close(); }
});

test('adding a house system to a legacy event keeps its model without rewriting the original chart', async () => {
  const ctx = await setup();
  try {
    const original = structuredClone(ctx.saved.chart);
    const equal = await ctx.controller.selectEvent(event.id, { houseSystem: 'equal' });
    assert.equal(equal.chart.calculationVersion, 1);
    assert.equal(equal.chart.options.houseSystem, 'equal');
    assert.deepEqual(await ctx.recordStore.getChart(original.chartId), original);
    assert.equal(ctx.controller.previewTime(15).chart.calculationVersion, 1);
  } finally { await ctx.recordStore.close(); }
});

test('unavailable model 2 geometry refuses save and shared restore before writes or selection changes', async () => {
  const ctx = await setup();
  try {
    const date = new Date(event.utcStart);
    const obliquity = Astronomy.e_tilt(Astronomy.MakeTime(date)).tobl;
    const longitude = ((270 - Astronomy.SiderealTime(date) * 15 + 540) % 360) - 180;
    const boundaryDraft = { ...draft, id: 'unavailable', latitude: 90 - obliquity, longitude };
    const boundary = eventFromDraft(boundaryDraft);
    const before = await ctx.recordStore.serializeRecords(), selected = ctx.controller.selectionSnapshot();
    const state = ctx.moduleState.get('astroeye'), time = ctx.worldClock.now().toISOString(), count = ctx.presented.length;
    await assert.rejects(ctx.controller.saveDraft(boundaryDraft), /Angles unavailable/);
    await assert.rejects(ctx.controller.restoreSharedView(createSharedView(boundary)), /Angles unavailable/);
    assert.equal(await ctx.recordStore.serializeRecords(), before);
    assert.deepEqual(ctx.controller.selectionSnapshot(), selected);
    assert.deepEqual(ctx.moduleState.get('astroeye'), state);
    assert.equal(ctx.worldClock.now().toISOString(), time);
    assert.equal(ctx.presented.length, count);
    assert.equal(calculateAstroEyeChart(boundary, { calculationVersion: 1 }).calculationVersion, 1);
  } finally { await ctx.recordStore.close(); }
});
