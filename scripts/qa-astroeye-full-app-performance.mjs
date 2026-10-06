import assert from 'node:assert/strict';
import { uncachedChartCases } from './qa-astroeye-uncached-cases.mjs';
import { PERFORMANCE_BUDGET, reviewPerformanceSamples } from './qa-astroeye-performance-policy.mjs';
import { validateResearchAnnotations } from '../src/modules/astroeye/researchAnnotations.js';

/** Runs only in the parent runner's owned, fresh synthetic profile. */
export async function checkFullAppPerformance({ page, mode, manifest, mark }) {
  const count = mode === 'performance-1000' ? 1000 : 100;
  const backup = JSON.parse(manifest.backup), base = backup.events[0];
  const cases = uncachedChartCases();
  backup.events = Array.from({ length: count }, (_, i) => i === 0 ? base : {
    ...structuredClone(base), id: `qa-performance-${i}`, title: `${i % 2 ? 'Odd' : 'Even'} synthetic ${i}`,
    venue: { ...base.venue, latitude: 39 + (i % 20) / 20, longitude: -76 + (i % 25) / 25 },
  });
  cases.forEach((entry, i) => { backup.events[i + 1] = entry.event; });
  const annotations = backup.workspaces.find(w => w.kind === 'astroeye-event-annotations');
  const note = annotations.annotations[0];
  annotations.annotations = Array.from({ length: 100 }, (_, i) => ({ ...note, id: `astroeye-note:qa-performance-${i}`,
    latitude: 39 + (i % 10) / 10, longitude: -76 + Math.floor(i / 10) / 10 }));
  validateResearchAnnotations(annotations);
  mark(`${mode}-seed`);
  await page.evaluate(async backup => {
    const app = __godsEyeView;
    await app.worldPlatform.recordStore.importRecords(JSON.stringify(backup));
    await app.astroEyeWorkspace.open();
    await app.astroEyeWorkspace.selectSavedEvent(backup.events[0].id, { navigate: false, persistChart: false, houseSystem: 'equal' });
    app.viewer.camera.cancelFlight();
    app.worldPlatform.moduleState.set('qa-unrelated', { preserved: true });
    app.viewer.entities.add({ id: 'qa-unrelated-entity', name: 'Synthetic other module' });
  }, backup);
  if (mode === 'performance-idle' || mode === 'performance-active') {
    await page.waitForFunction(() => {
      const { viewer } = __godsEyeView;
      const event = viewer.entities.getById('t-rexx-astroeye-selected-event');
      const c = viewer.scene.globe.ellipsoid.cartesianToCartographic(event.position.getValue(viewer.clock.currentTime));
      const height = viewer.scene.globe.getHeight(c);
      viewer.scene.requestRender();
      return Number.isFinite(height) && Math.abs(height) > 1 && viewer.scene.globe.tilesLoaded;
    }, { timeout: 12000, polling: 200 });
    mark(`${mode}-event-sky`);
    const observation = await page.evaluate(async active => {
      const app = __godsEyeView, workspace = app.astroEyeWorkspace, viewer = app.viewer;
      const ring = app.styleManager.celestialRing, store = app.worldPlatform.recordStore;
      const records = await store.serializeRecords();
      workspace.root.querySelector('[data-action="event-sky"]').click();
      viewer.camera.cancelFlight();
      const before = ring.getPerformanceCounters();
      const selectedEntity = viewer.entities.getById('t-rexx-astroeye-selected-event');
      const location = viewer.scene.globe.ellipsoid.cartesianToCartographic(selectedEntity.position.getValue(viewer.clock.currentTime));
      const terrainHeightMeters = viewer.scene.globe.getHeight(location);
      if (!before.eventSkyEnabled) throw Error('Event sky did not enable');
      let frames = 0, chartMutations = 0;
      const off = viewer.scene.postRender.addEventListener(() => frames++);
      const observer = new MutationObserver(changes => { chartMutations += changes.length; });
      observer.observe(workspace.root.querySelector('.astroeye-chart svg'), { subtree: true, childList: true, attributes: true });
      const initial = app.styleManager.getCameraState();
      if (active) viewer.camera.flyTo({ destination: viewer.camera.position.clone(),
        orientation: { heading: viewer.camera.heading + 0.3, pitch: viewer.camera.pitch, roll: viewer.camera.roll }, duration: 2 });
      const start = performance.now();
      await new Promise(resolve => setTimeout(resolve, 10000));
      const elapsedMs = performance.now() - start, after = ring.getPerformanceCounters();
      off(); observer.disconnect();
      if (elapsedMs > 15000) throw Error('Observation outside existing 10–15 second window');
      if (after.ephemerisUpdates !== before.ephemerisUpdates || chartMutations) throw Error('Unexpected idle/frame chart work');
      if (active && frames < 2) throw Error('No actual moving scene frames observed');
      if (await store.serializeRecords() !== records) throw Error('Observation changed records');
      if (!app.worldPlatform.moduleState.get('qa-unrelated')?.preserved || !viewer.entities.getById('qa-unrelated-entity')) throw Error('Other module state lost');
      return { elapsedMs, frames, chartMutations, terrainHeightMeters, ephemerisDelta: after.ephemerisUpdates - before.ephemerisUpdates,
        before, after, governor: app.getRenderGovernorDiagnostics(), activeCameraFlight: active,
        cameraMoved: JSON.stringify(initial) !== JSON.stringify(app.styleManager.getCameraState()) };
    }, mode === 'performance-active');
    assert.equal(observation.activeCameraFlight ? observation.cameraMoved : !observation.cameraMoved, true);
    return { passed: true, observation, count, recordsAndOtherModulePreserved: true,
      gpuTimingMeasured: false, physicalInputLatencyMeasured: false };
  }
  mark(`${mode}-measure`);
  const result = await page.evaluate(async ({ count, cases, eventId }) => {
    const app = __godsEyeView, workspace = app.astroEyeWorkspace, root = workspace.root, store = app.worldPlatform.recordStore;
    const require = (condition, message) => { if (!condition) throw Error(message); };
    const records = await store.serializeRecords(), camera = JSON.stringify(app.styleManager.getCameraState());
    const layers = JSON.stringify([...app.dataManager.layers].map(([id, layer]) => [id, layer.enabled]));
    const clock = { shouldAnimate: app.viewer.clock.shouldAnimate, multiplier: app.viewer.clock.multiplier, clockStep: app.viewer.clock.clockStep };
    const measure = async (action, verify, iterations = 5) => {
      const samples = [];
      for (let i = 0; i <= iterations; i++) {
        const start = performance.now(); await action();
        await new Promise(resolve => requestAnimationFrame(resolve)); root.getBoundingClientRect();
        if (i) samples.push(performance.now() - start);
        await verify();
      }
      return samples;
    };
    const samples = {};
    samples.openList = await measure(() => workspace.open(), () => require(root.querySelectorAll('#astroeye-saved-event-list [data-event-id]').length === 25, '25-row page cap'));
    samples.filterList = await measure(() => {
      const form = root.querySelector('.astroeye-event-filters'); form.elements.namedItem('query').value = 'synthetic'; form.requestSubmit();
    }, () => require(root.querySelectorAll('#astroeye-saved-event-list [data-event-id]').length <= 25, 'Filtered cap'));
    root.querySelector('[data-filter-reset]').click();
    samples.cachedSelection = await measure(() => workspace.selectSavedEvent(eventId, { navigate: false, persistChart: false, houseSystem: 'equal' }),
      () => require(workspace.sceneSnapshot().event.id === eventId, 'Selected identity'));
    samples.timePreview = await measure(() => workspace.previewCommandTime(15),
      () => require(workspace.sceneSnapshot().offsetMinutes === 15, 'Exact preview offset'));
    const uncached = [];
    for (const entry of cases) for (const houseSystem of ['whole-sign', 'equal']) {
      const timings = await measure(() => workspace.selectSavedEvent(entry.event.id, { navigate: false, persistChart: false, houseSystem }), async () => {
        const view = workspace.sceneSnapshot();
        require(view.event.id === entry.event.id && view.houseSystem === houseSystem, 'Cache-miss identity and houses');
        require((await store.listCharts({ eventId: entry.event.id })).length === 0, 'Cache miss stays read-only');
        require(!!root.querySelector('.astroeye-chart svg'), 'Chart rendered');
      }, 3);
      uncached.push({ id: entry.id, houseSystem, samples: timings });
    }
    const markerCounts = () => ({ saved: app.viewer.entities.values.filter(e => e.id.startsWith('t-rexx-astroeye-saved-')).length,
      notes: app.viewer.entities.values.filter(e => e.id.startsWith('t-rexx-astroeye-note-')).length });
    const waitUntil = async predicate => { const end = performance.now() + 3000; while (!predicate()) {
      if (performance.now() > end) throw Error(`Marker operation timed out: ${JSON.stringify(markerCounts())}; ${root.querySelector('[data-annotation="map-status"]').textContent}`); await new Promise(resolve => setTimeout(resolve, 20));
    } };
    samples.savedMarkers = await measure(async () => {
      root.querySelector('[data-action="saved-map"]').click(); await waitUntil(() => markerCounts().saved === Math.min(100, count - 1));
    }, async () => {
      root.querySelector('[data-action="saved-map"]').click(); await waitUntil(() => markerCounts().saved === 0);
    }, 3);
    root.querySelector('[data-action="event-notes"]').click();
    await waitUntil(() => !root.querySelector('[data-annotation="reload"]').disabled);
    samples.noteMarkers = await measure(async () => {
      root.querySelector('[data-annotation="map-toggle"]').click(); await waitUntil(() => markerCounts().notes === 100);
    }, async () => {
      root.querySelector('[data-annotation="map-toggle"]').click(); await waitUntil(() => markerCounts().notes === 0);
    }, 3);
    require(await store.serializeRecords() === records, 'All record bytes preserved');
    require(JSON.stringify(app.styleManager.getCameraState()) === camera, 'Read-only actions retain camera');
    require(JSON.stringify([...app.dataManager.layers].map(([id, layer]) => [id, layer.enabled])) === layers, 'Other layers preserved');
    require(Object.entries(clock).every(([key, value]) => app.viewer.clock[key] === value), 'Live viewer clock policy preserved');
    require(app.worldPlatform.moduleState.get('qa-unrelated')?.preserved && app.viewer.entities.getById('qa-unrelated-entity'), 'Other module state/entity preserved');
    return { samples, uncached, count, savedMarkerCap: 100, noteMarkers: 100, listCap: 25 };
  }, { count, cases, eventId: base.id });
  for (const [key, samples] of Object.entries(result.samples)) result.samples[key] = reviewPerformanceSamples(samples);
  for (const entry of result.uncached) { entry.timing = reviewPerformanceSamples(entry.samples); delete entry.samples; }
  assert.ok(Object.values(result.samples).every(value => value.accepted) && result.uncached.every(value => value.timing.accepted), JSON.stringify(result));
  return { passed: true, ...result, budget: PERFORMANCE_BUDGET, warmups: 1,
    recordsCameraLayersAndOtherModulePreserved: true, timingBoundary: 'action promise plus animation frame and forced layout; not physical-input or GPU latency',
    gpuTimingMeasured: false, physicalInputLatencyMeasured: false };
}
