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
  const saved = await controller.saveDraft(draft);
  return { recordStore, controller, saved, moduleState, worldClock, presented };
}

test('new chart and preview tag v1 without changing v1 identity or silently accepting future math', () => {
  const chart = calculateAstroEyeChart(event);
  assert.equal(chart.calculationVersion, 1);
  assert.equal(chart.chartId, `astroeye:${event.id}:${event.utcStart}:tropical-geocentric:whole-sign`);
  assert.equal(calculateTimePreview(event, 15, { calculationVersion: 1 }).calculationVersion, 1);
  for (const calculationVersion of [2, null, '1', 0]) {
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
      (chart) => { chart.calculationVersion = 2; },
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
    await ctx.recordStore.saveChart({ ...ctx.saved.chart, chartId: '000-future', calculationVersion: 2 });
    const before = await ctx.recordStore.serializeRecords();
    assert.equal((await ctx.controller.selectEvent(event.id)).chart.chartId, ctx.saved.chart.chartId);
    assert.equal(await ctx.recordStore.serializeRecords(), before);
  } finally { await ctx.recordStore.close(); }
});

test('model mismatches suppress comparisons, cross-aspects and reports; labels preserve model provenance', () => {
  const chart = calculateAstroEyeChart(event), pin = captureComparison(event, chart);
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
    assert.throws(() => createSharedView(event, { calculationVersion: 2 }), /version/);
    assert.throws(() => createAstroEyeTour({ ...share, calculationVersion: 2 }), /version/);
    await assert.rejects(ctx.controller.restoreSharedView({ ...share, calculationVersion: 2 }), /version/);
    assert.equal(await ctx.recordStore.serializeRecords(), before);
    assert.deepEqual(ctx.controller.selectionSnapshot(), selected);
  } finally { await ctx.recordStore.close(); }
});
