import assert from 'node:assert/strict';
import { summarizeTimings } from './qa-performance-stats.mjs';

/** Native IndexedDB + mounted workspace in an already owned disposable context. */
export async function checkCollectionWorkflow(page, mark, count) {
  assert.ok([25, 100, 1000].includes(count), 'Choose a bounded collection size: 25, 100 or 1000');
  await page.exposeFunction('qaCollectionPhase', mark);
  const result = await page.evaluate(async (count) => {
    const { eventFromDraft } = await import('/src/modules/astroeye/workspaceController.js');
    const { calculateAstroEyeChart } = await import('/src/modules/astroeye/calculation/chart.js');
    const require = (condition, message) => { if (!condition) throw new Error(message); };
    await window.qaCollectionPhase(`collections-${count}-seed`);
    const base = eventFromDraft({ id: 'synthetic-collection', title: 'Synthetic collection', sport: 'Football', competition: 'QA',
      home: 'Home', away: 'Away', localDate: '2026-09-15', localTime: '12:00:00', timeZone: 'UTC',
      venueName: 'Synthetic venue', latitude: 40, longitude: -75 });
    const events = Array.from({ length: count }, (_, i) => {
      const utcStart = new Date(Date.UTC(2026, 0, 1, 12) + ((i * 37) % count) * 86400000).toISOString();
      return { ...structuredClone(base), id: `synthetic-collection-${String(i).padStart(4, '0')}`,
        title: `${i % 2 ? 'Odd' : 'Even'} synthetic event ${i}`, utcStart,
        scheduledLocal: { date: utcStart.slice(0, 10), time: '12:00:00', timeZone: 'UTC' } };
    });
    const chart = calculateAstroEyeChart(events[0]);
    const input = JSON.stringify({ schemaVersion: 1, events, charts: [chart], workspaces: [] });
    const seedStart = performance.now();
    const imported = await qa.store.importRecords(input);
    const seedMs = performance.now() - seedStart;
    require(imported.events === count && imported.charts === 1, 'Synthetic seed counts');
    await qa.workspace.open();
    await qa.workspace.selectSavedEvent(events[0].id, { navigate: false, persistChart: false });
    await qa.notes.add(qa.controller.selectionSnapshot(), 'PRIVATE-SYNTHETIC-PERFORMANCE-NOTE', null);
    await qa.notebook.save('PRIVATE-SYNTHETIC-PERFORMANCE-NOTEBOOK', null);
    const before = await qa.store.serializeRecords();
    const root = qa.workspace.root;
    const listButtons = () => root.querySelectorAll('#astroeye-saved-event-list button[data-event-id]');
    require(listButtons().length === 25, 'Initial list is paginated to 25 rows');
    const atLayout = async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      root.getBoundingClientRect();
    };
    const measure = async (name, action, verify, layout = false) => {
      await window.qaCollectionPhase(`collections-${count}-${name}`);
      const samples = [];
      for (let i = 0; i < 6; i++) {
        const start = performance.now();
        const value = await action();
        if (layout) await atLayout();
        const elapsed = performance.now() - start;
        verify(value);
        if (i) samples.push(elapsed); // One warmup, five measured iterations.
      }
      return samples;
    };
    const read = await measure('native-read', () => qa.store.listEvents(), (rows) => require(rows.length === count, 'Native read count'));
    const reopen = await measure('open-list', () => qa.workspace.open(), () => {
      require(listButtons().length === 25, 'Open must retain 25 rows');
      require(root.querySelector('[data-role="page-status"]').textContent.includes(`of ${count} matching`), 'Open total count');
    }, true);
    const filter = await measure('filter-list', () => {
      const form = root.querySelector('.astroeye-event-filters');
      form.elements.namedItem('query').value = 'Even synthetic'; form.requestSubmit();
    }, () => {
      require(listButtons().length === Math.min(25, Math.ceil(count / 2)), 'Filtered page size');
      require(root.querySelector('[data-role="filter-status"]').textContent.startsWith(`${Math.ceil(count / 2)} of ${count}`), 'Filter total count');
    }, true);
    root.querySelector('[data-filter-reset]').click();
    const selection = await measure('cached-selection', () => qa.workspace.selectSavedEvent(events[0].id, { navigate: false, persistChart: false }), () => {
      require(!!root.querySelector('.astroeye-chart:not([hidden]) svg'), 'Chart SVG mounted');
      require(qa.controller.selectionSnapshot().chart.calculatedFor === events[0].utcStart, 'Cached chart instant');
    }, true);
    const preview = await measure('time-preview', () => qa.workspace.previewCommandTime(15), (applied) => {
      require(applied === true, 'Preview applied');
      require(Date.parse(qa.controller.selectionSnapshot().chart.calculatedFor) - Date.parse(events[0].utcStart) === 900000, 'Exact preview instant');
    }, true);
    require(await qa.store.serializeRecords() === before, 'Measured actions must preserve event, chart and private workspace bytes');
    require(qa.navigation === 0, 'No camera-navigation request');
    await window.qaCollectionPhase(`collections-${count}-reopen-storage`);
    await qa.store.close();
    require((await qa.store.listEvents()).length === count, 'Data survives a closed/reopened native connection');
    require(await qa.store.serializeRecords() === before, 'Reopened connection preserves exact backup');
    return { count, seedMs, samples: { nativeRead: read, openList: reopen, filterList: filter, cachedSelection: selection, timePreview: preview },
      nativeStorageReopened: true, recordsPreserved: true, listCap: 25, warmups: 1, measuredSamples: 5 };
  }, count);
  for (const [name, samples] of Object.entries(result.samples)) {
    result.samples[name] = { ...summarizeTimings(samples), rawMs: samples.map((n) => Math.round(n * 1000) / 1000) };
  }
  result.seedMs = Math.round(result.seedMs * 1000) / 1000;
  return { passed: true, ...result, viewport: page.viewport(), browserVersion: await page.browser().version(),
    timingBoundary: 'Storage promise completion; UI actions additionally await one animation frame and force root layout. Not screen presentation latency.',
    scope: 'mounted workspace only; same-record cached selection and fixed +15-minute previews',
    assetTransport: 'node-localhost', cameraSeamMocked: true, gpuMeasured: false, embeddedHostVerified: false,
    acceptance: 'observational only; no supported collection limit or timing budget accepted' };
}
