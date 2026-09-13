import assert from 'node:assert/strict';
import test from 'node:test';
import { indexedDB } from 'fake-indexeddb';
import { createWorldRecordStore } from '../../core/worldRecordStore.js';
import { EventBus } from '../../core/eventBus.js';
import { ModuleStateCoordinator } from '../../core/moduleState.js';
import { WorldClock } from '../../core/worldClock.js';
import { createAstroEyeWorkspaceController, eventFromDraft } from './workspaceController.js';
import { calculateAstroEyeChart } from './calculation/chart.js';
import { isSupportedChartCalculation } from './calculation/modelVersion.js';
import { chartTimePolicyNote } from './calculation/timeConventions.js';
import { calculateUtcTtPositions } from './calculation/utcTtPositions.js';
import { captureComparison, compareCharts } from './chartComparison.js';
import { serializeComparisonReport } from './comparisonReport.js';
import { createNotebookChartReference } from './notebookChartReference.js';
import { createSharedView, encodeSharedView, decodeSharedView } from './shareView.js';
import { readRangeReference, RANGE_BODIES } from '../../../scripts/astroeye-range-references.mjs';
import { signedDelta, POSITION_LIMIT_ARCSECONDS } from '../../../scripts/astroeye-horizons.mjs';

const draft = { id: 'model-four', title: 'Synthetic model four', sport: 'Demo', competition: 'QA', home: 'A', away: 'B',
  localDate: '2100-12-31', localTime: '12:00:00', timeZone: 'UTC', venueName: 'Synthetic', latitude: 40, longitude: -75 };
const event = eventFromDraft(draft);
test('default full charts pass all 90 independent range position samples', () => {
  for (const body of RANGE_BODIES) for (const row of readRangeReference(body).rows) {
    const input = eventFromDraft({ ...draft, localDate: row.instant.slice(0, 10), localTime: row.instant.slice(11, 19) });
    const chart = calculateAstroEyeChart(input);
    assert.equal(chart.calculationVersion, 4);
    assert.ok(isSupportedChartCalculation(chart));
    const actual = chart.positions.find((p) => p.body === body);
    assert.ok(Math.abs(signedDelta(row.longitude, actual.longitude)) * 3600 <= POSITION_LIMIT_ARCSECONDS);
    assert.ok(Math.abs(row.latitude - actual.latitude) * 3600 <= POSITION_LIMIT_ARCSECONDS);
  }
});
test('new model uses corrected positions, preserves inherited angle/hour results and has its own identity', () => {
  const modern = calculateAstroEyeChart(event), old = calculateAstroEyeChart(event, { calculationVersion: 3 });
  assert.ok(modern.chartId.endsWith(':model-4'));
  assert.notEqual(modern.chartId, old.chartId);
  assert.deepEqual(modern.houses, old.houses);
  assert.deepEqual(modern.planetaryHour, old.planetaryHour);
  assert.notDeepEqual(modern.positions, old.positions);
  assert.deepEqual(modern.positions.map(({ body, longitude, latitude, motionDegPerDay, retrograde }) => ({ body, longitude, latitude, motionDegPerDay, retrograde })),
    calculateUtcTtPositions(event.utcStart).positions);
  assert.equal(old.timeConventions, undefined);
  assert.ok(Object.isFrozen(modern.timeConventions.positions));
  const roundTrip = JSON.parse(JSON.stringify(modern));
  assert.ok(isSupportedChartCalculation(roundTrip));
  for (const mutate of [
    (c) => { delete c.timeConventions; },
    (c) => { c.timeConventions.positions.policy = 'future'; },
    (c) => { c.timeConventions.positions.inputInstant = '2000-01-01T00:00:00Z'; },
    (c) => { c.timeConventions.positions.ttMinusInputSeconds = 205; },
    (c) => { c.timeConventions.angles = 'changed'; },
    (c) => { c.timeConventions.skyRotation = 'changed'; },
  ]) {
    const bad = structuredClone(modern); mutate(bad);
    assert.equal(isSupportedChartCalculation(bad), false);
    assert.throws(() => captureComparison(event, bad), /unsupported/);
  }
});
test('notes, pins and reports disclose historical/future policy without changing legacy output', () => {
  for (const [date, label] of [['1900-01-01', /historical timing is approximate/], ['2026-09-13', /Published historical UTC/], ['2100-12-31', /Future leap seconds are unknown/]]) {
    const input = eventFromDraft({ ...draft, localDate: date }), chart = calculateAstroEyeChart(input), pin = captureComparison(input, chart);
    assert.match(chartTimePolicyNote(chart), label);
    assert.match(pin.timeNote, label);
    assert.match(serializeComparisonReport(pin, pin), label);
    assert.match(createNotebookChartReference(input, chart), label);
    assert.match(pin.timeNote, /sky rotation and planetary hours retain model 3/);
    assert.equal(compareCharts(pin, { ...pin, positionTimePolicy: undefined }).rows.length, 0);
    const old = calculateAstroEyeChart(input, { calculationVersion: 3 });
    assert.equal(chartTimePolicyNote(old), '');
    assert.equal(compareCharts(pin, captureComparison(input, old)).rows.length, 0);
  }
});
test('model-four cache, additional houses, previews, share replay and corrupt metadata preserve storage', async () => {
  const recordStore = createWorldRecordStore({ indexedDB, databaseName: 'model-four-integration' });
  const eventBus = new EventBus(), moduleState = new ModuleStateCoordinator({ eventBus }), worldClock = new WorldClock({ eventBus });
  const controller = createAstroEyeWorkspaceController({ recordStore, eventBus, moduleState, worldClock });
  try {
    const saved = await controller.saveDraft(draft);
    assert.equal(saved.chart.calculationVersion, 4);
    const before = await recordStore.serializeRecords();
    const preview = controller.previewTime(15);
    assert.equal(preview.chart.timeConventions.positions.inputInstant, preview.chart.calculatedFor);
    assert.equal(preview.event.utcStart, event.utcStart);
    const share = decodeSharedView(encodeSharedView(controller.shareSnapshot()));
    assert.equal(share.calculationVersion, 4);
    assert.equal(share.timeConventions, undefined, 'Links contain inputs, not computed metadata');
    await controller.restoreSharedView(share);
    assert.deepEqual(controller.selectionSnapshot().chart, preview.chart);
    assert.equal(await recordStore.serializeRecords(), before);
    await controller.selectEvent(event.id);
    const equal = await controller.selectEvent(event.id, { houseSystem: 'equal' });
    assert.equal(equal.chart.calculationVersion, 4);
    assert.ok(isSupportedChartCalculation(equal.chart));
    assert.deepEqual(await recordStore.getChart(saved.chart.chartId), saved.chart);
    const archive = await recordStore.serializeRecords();
    await recordStore.importRecords(archive, { mode: 'replace' });
    assert.equal(await recordStore.serializeRecords(), archive);
    await controller.selectEvent(event.id, { houseSystem: 'whole-sign' });
    const bad = structuredClone(saved.chart); delete bad.timeConventions;
    await recordStore.saveChart(bad);
    const corruptBefore = await recordStore.serializeRecords(), selected = controller.selectionSnapshot();
    await assert.rejects(controller.selectEvent(event.id, { houseSystem: 'whole-sign' }), /unsupported/);
    assert.equal(await recordStore.serializeRecords(), corruptBefore);
    assert.deepEqual(controller.selectionSnapshot(), selected);
  } finally { await recordStore.close(); }
});
