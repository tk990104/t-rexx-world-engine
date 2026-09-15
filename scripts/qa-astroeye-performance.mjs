import { Worker, isMainThread, parentPort } from 'node:worker_threads';

// A parent-owned worker deadline also interrupts synchronous CPU stalls.
// No browser, disk-backed records, network requests or production data.
if (isMainThread) {
  const worker = new Worker(new URL(import.meta.url));
  let report, failed = false;
  const timer = setTimeout(() => {
    failed = true; report = { passed: false, error: '60-second worker deadline exceeded' };
    void worker.terminate();
  }, 60000);
  worker.on('message', (value) => { report = value; });
  worker.on('error', (error) => { failed = true; report = { passed: false, error: error.message }; });
  worker.on('exit', (code) => {
    clearTimeout(timer);
    if (code !== 0) failed = true;
    if (!report) report = { passed: false, error: 'Worker exited without a report' };
    if (failed) report.passed = false;
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    process.exitCode = !failed && report.passed ? 0 : 1;
  });
} else {
  const { default: assert } = await import('node:assert/strict');
  const { summarizeTimings } = await import('./qa-performance-stats.mjs');
  const { EntityCollection } = await import('cesium');
  const { EventBus } = await import('../src/core/eventBus.js');
  const { filterSavedEvents, sortSavedEvents, pageSavedEvents } = await import('../src/modules/astroeye/savedEventFilters.js');
  const { createSavedEventLayer, SAVED_EVENT_LIMIT, savedEventEntityId } = await import('../src/modules/astroeye/savedEventLayer.js');
  const { eventFromDraft } = await import('../src/modules/astroeye/workspaceController.js');
  const { calculateAstroEyeChart } = await import('../src/modules/astroeye/calculation/chart.js');
  const { calculateTimePreview } = await import('../src/modules/astroeye/timeExplorer.js');
  const started = performance.now();
  const draft = { id: 'synthetic-performance', title: 'Synthetic Home at Away', sport: 'Football', competition: 'QA',
    home: 'Home', away: 'Away', localDate: '2026-09-15', localTime: '12:00:00', timeZone: 'UTC',
    venueName: 'Synthetic venue', latitude: 40, longitude: -75 };
  const base = eventFromDraft(draft);
  const rows = [], charts = [];
  const measure = async (action, verify) => {
    // Warm module/JIT paths twice; correctness checks are outside timed sections.
    for (let i = 0; i < 2; i++) verify(await action());
    const samples = [];
    for (let i = 0; i < 9; i++) {
      const start = performance.now(); const result = await action();
      samples.push(performance.now() - start); verify(result);
    }
    return { ...summarizeTimings(samples), rawMs: samples.map((n) => Math.round(n * 1000) / 1000) };
  };
  for (const count of [25, 100, 1000, 10000]) {
    const events = Array.from({ length: count }, (_, i) => {
      const day = (i * 37) % count;
      const utcStart = new Date(Date.UTC(2026, 0, 1, 12) + day * 86400000).toISOString();
      return { ...structuredClone(base), id: `synthetic-${String(i).padStart(5, '0')}`, title: `${i % 2 ? 'Odd' : 'Even'} synthetic event ${i}`,
        utcStart, scheduledLocal: { date: utcStart.slice(0, 10), time: '12:00:00', timeZone: 'UTC' } };
    });
    const before = JSON.stringify(events);
    const all = await measure(() => filterSavedEvents(events), (value) => assert.equal(value.length, count));
    const search = await measure(() => pageSavedEvents(sortSavedEvents(filterSavedEvents(events, { query: 'Even synthetic' }))),
      (value) => { assert.equal(value.total, Math.ceil(count / 2)); assert.equal(value.items.length, Math.min(25, value.total)); });
    const sort = await measure(() => pageSavedEvents(sortSavedEvents(events)),
      (value) => { assert.equal(value.total, count); assert.equal(value.items.length, 25); });
    const eventBus = new EventBus(), entities = new EntityCollection();
    entities.add({ id: 'unrelated' }); let reads = 0;
    const selected = events[0];
    const layer = createSavedEventLayer({ viewer: { entities, scene: { requestRender() {} } }, eventBus,
      listEvents: async () => { reads++; return events; }, getSelection: () => ({ event: selected, isShared: false }) });
    // Include one real state subscriber, as the mounted workspace uses one.
    const unsubscribe = layer.subscribe(() => {});
    let marker;
    try {
      await layer.setEnabled(true);
      marker = await measure(() => layer.setFilters({}), () => {
        assert.equal(layer.state().shown, Math.min(SAVED_EVENT_LIMIT, count - 1));
        assert.equal(entities.values.length, Math.min(SAVED_EVENT_LIMIT, count - 1) + 1);
        assert.equal(layer.eventIdForEntity(savedEventEntityId(selected.id)), null);
      });
      assert.equal(reads, 1, 'Refiltering must not read storage');
      layer.setSuspended(true); assert.equal(layer.state().shown, 0);
    } finally { unsubscribe(); layer.destroy(); }
    assert.deepEqual(entities.values.map((entity) => entity.id), ['unrelated']);
    assert.equal(JSON.stringify(events), before, 'Measurements must not mutate input records');
    rows.push({ count, stressOnly: count === 10000, all, searchAndPage: search, sortAndPage: sort, markerRebuild: marker });
  }
  for (const date of ['1900-01-01', '2026-09-15', '2100-12-31']) {
    const event = eventFromDraft({ ...draft, localDate: date });
    const before = JSON.stringify(event);
    const verify = (chart) => { assert.equal(chart.positions.length, 10); assert.ok(Number.isFinite(chart.positions[0].longitude)); };
    const calculate = await measure(() => calculateAstroEyeChart(event), verify);
    const preview = await measure(() => calculateTimePreview(event, 15), (chart) => {
      verify(chart); assert.equal(Date.parse(chart.calculatedFor) - Date.parse(event.utcStart), 15 * 60000);
    });
    assert.equal(JSON.stringify(event), before);
    charts.push({ date, calculate, preview });
  }
  parentPort.postMessage({ passed: true, schema: 'trexx-cpu-baseline-v1', runtime: process.version,
    platform: process.platform, arch: process.arch, elapsedMs: Math.round(performance.now() - started),
    warmups: 2, samples: 9, percentile: 'nearest-rank; with 9 samples p95 is the maximum',
    rows, charts, storageSimulated: true, browserRenderingMeasured: false, userDataAccessed: false,
    acceptance: 'observational baseline only; no release support limit or timing budget accepted' });
}
