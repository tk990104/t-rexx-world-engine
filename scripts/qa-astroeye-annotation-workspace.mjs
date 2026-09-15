import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import puppeteer from 'puppeteer';
import { closeOwnedBrowser } from './qa-owned-browser-cleanup.mjs';

let browser, page, report;
const watchdog = setTimeout(() => { browser?.process()?.kill(); process.exit(1); }, 60000);
try {
  browser = await puppeteer.launch({ headless: true, timeout: 15000, args: ['--disable-gpu', '--disable-background-networking'] });
  page = await browser.newPage(); page.setDefaultTimeout(10000);
  await page.setViewport({ width: 1200, height: 900 });
  const base = process.env.QA_BASE_URL || 'http://127.0.0.1:5173';
  const unexpected = [], errors = [];
  let embeddedIcons = 0;
  page.on('pageerror', (error) => errors.push(error.name));
  page.on('dialog', (dialog) => void dialog.accept()); // Disposable synthetic fixtures only.
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.protocol === 'data:' && request.resourceType() === 'image' && url.pathname.startsWith('image/svg+xml;base64,')) {
      embeddedIcons++; void request.continue(); return;
    }
    if (url.origin !== new URL(base).origin || url.pathname.startsWith('/api/')) {
      unexpected.push({ origin: url.origin, path: url.pathname }); void request.abort();
    } else if (request.resourceType() === 'document') void request.respond({ contentType: 'text/html', body: '<html><body></body></html>' });
    else void request.continue();
  });
  async function mount() {
    await page.evaluate(async () => {
      const { mountAstroEyeWorkspace } = await import('/src/modules/astroeye/astroeyeWorkspace.js');
      const { createAstroEyeWorkspaceController } = await import('/src/modules/astroeye/workspaceController.js');
      const { createResearchAnnotations } = await import('/src/modules/astroeye/researchAnnotations.js');
      const { createResearchAnnotationLayer } = await import('/src/modules/astroeye/researchAnnotationLayer.js');
      const { createResearchNotebook } = await import('/src/modules/astroeye/researchNotebook.js');
      const { createWorldRecordStore } = await import('/src/core/worldRecordStore.js');
      const { EventBus } = await import('/src/core/eventBus.js');
      const { WorldClock } = await import('/src/core/worldClock.js');
      const { ModuleStateCoordinator } = await import('/src/core/moduleState.js');
      const store = createWorldRecordStore({ databaseName: 'qa-annotation-workspace-synthetic' });
      const eventBus = new EventBus(), worldClock = new WorldClock({ eventBus });
      const qa = { store, reads: 0, navigation: 0, directorRunning: false, downloads: [], holdSource: false, releaseSource: null };
      const controller = createAstroEyeWorkspaceController({ recordStore: store, eventBus, worldClock,
        moduleState: new ModuleStateCoordinator({ eventBus }), presentEvent: async () => { qa.navigation++; } });
      if (!(await store.listEvents()).length) {
        for (const id of ['one', 'two']) await controller.saveDraft({ id, title: `Synthetic ${id}`, sport: 'QA', competition: 'QA', home: 'H', away: 'A',
          localDate: '2026-09-14', localTime: '12:00', timeZone: 'UTC', venueName: 'QA', latitude: id === 'one' ? 40 : 30, longitude: -75 });
        await createResearchNotebook(store).save('Separate notebook sentinel', null);
      }
      const notes = createResearchAnnotations(store);
      const markers = new Map(); let markerReads = 0;
      const viewer = { scene: { requestRender() {} }, entities: {
        add: (entity) => { if (markers.has(entity.id)) throw new Error('Duplicate ID'); markers.set(entity.id, entity); return entity; },
        getById: (id) => markers.get(id), remove: (entity) => markers.delete(entity.id),
      } };
      const noteLayer = createResearchAnnotationLayer({ viewer, eventBus, modeTarget: document.body,
        loadAnnotations: () => { markerReads++; return notes.load(); },
        canDisplay: () => !qa.directorRunning && !document.body.classList.contains('scene-playback-mode') && !controller.selectionSnapshot()?.isShared });
      const workspace = mountAstroEyeWorkspace({ controller, researchNotebook: createResearchNotebook(store),
        researchAnnotationLayer: noteLayer,
        researchAnnotations: { ...notes, load: () => { qa.reads++; return notes.load(); }, sourceState: async (entry) => {
          if (qa.holdSource) await new Promise((resolve) => { qa.releaseSource = resolve; });
          return notes.sourceState(entry);
        } },
        canUseResearchAnnotations: () => !qa.directorRunning,
        downloadAnnotationDraft: (file) => qa.downloads.push(file),
      });
      Object.assign(qa, { notes, controller, workspace, markers, noteLayer, markerReads: () => markerReads }); window.qa = qa;
      await workspace.open();
    });
  }
  await page.goto(base, { waitUntil: 'domcontentloaded' }); await mount();
  const node = (name) => `[data-annotation="${name}"]`;
  const settle = () => page.waitForFunction(() => !document.querySelector('[data-annotation="reload"]').disabled);
  const click = async (name) => { await page.$eval(node(name), (element) => element.click()); await settle(); };
  const edit = (text) => page.$eval('[data-role="event-notes"] textarea', (element, text) => { element.value = text; element.dispatchEvent(new Event('input', { bubbles: true })); }, text);
  const value = () => page.$eval('[data-role="event-notes"] textarea', (element) => element.value);
  const chartAction = async (name) => {
    await page.$eval(`[data-action="${name}"]`, (element) => element.click());
    await page.waitForFunction(() => !document.querySelector('#astroeye-workspace').dataset.busy); await settle();
  };
  assert.equal(await page.evaluate(() => qa.reads), 0);
  assert.equal(await page.evaluate(() => qa.markerReads()), 0);
  assert.equal(await page.$eval('[data-role="event-notes"]', (element) => element.hidden), true);
  const beforeGuide = await page.evaluate(() => qa.store.serializeRecords());
  assert.equal(await page.$eval('[data-role="quick-start"]', (element) => element.open), false);
  await page.focus('[data-action="quick-start"]'); await page.keyboard.press('Enter');
  assert.equal(await page.$eval('[data-role="quick-start"]', (element) => element.open), true);
  assert.equal(await page.evaluate(() => document.activeElement.tagName), 'SUMMARY');
  assert.match(await page.$eval('[data-role="quick-start"]', (element) => element.textContent), /Compare charts → Pin this chart/);
  assert.equal(await page.evaluate(() => qa.reads), 0);
  assert.equal(await page.evaluate(() => qa.store.serializeRecords()), beforeGuide);
  await page.keyboard.press('Space');
  assert.equal(await page.$eval('[data-role="quick-start"]', (element) => element.open), false);
  await page.focus('[data-action="compare-charts"]'); await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => document.activeElement.classList.contains('astroeye-empty')), true);
  await page.focus('[data-action="find-saved-events"]'); await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.role), 'saved-events-heading');
  // Keyboard entry follows the user-visible quick navigation.
  await page.focus('[data-action="event-notes"]'); await page.keyboard.press('Enter'); await settle();
  assert.equal(await page.evaluate(() => document.activeElement.dataset.role), 'event-notes');
  assert.equal(await page.$eval(node('new'), (element) => element.disabled), true);
  await page.evaluate(() => qa.workspace.selectSavedEvent('one')); await settle();
  await page.focus('[data-action="compare-charts"]'); await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.role), 'chart-comparison');
  await page.focus('[data-comparison="pin"]'); await page.keyboard.press('Enter');
  const pinned = await page.$eval('[data-comparison="pinned"]', (element) => element.textContent);
  assert.match(pinned, /Synthetic one.*12:00:00/);
  await chartAction('time-forward'); await click('new'); await edit('Private event-note draft <img src=x>');
  const frozen = await page.$eval(node('capture'), (element) => element.textContent);
  assert.match(frozen, /12:15:00.000Z · 40, -75/);
  await page.evaluate(() => qa.workspace.selectSavedEvent('two')); await settle();
  assert.equal(await value(), 'Private event-note draft <img src=x>');
  assert.equal(await page.$eval(node('capture'), (element) => element.textContent), frozen);
  const selectionBeforeSave = await page.evaluate(() => qa.controller.selectionSnapshot());
  const navigationBeforeSave = await page.evaluate(() => qa.navigation);
  await click('save');
  const saved = await page.evaluate(async () => (await qa.notes.load()).annotations[0]);
  assert.equal(saved.eventId, 'one'); assert.equal(saved.chartTimeUtc, '2026-09-14T12:15:00.000Z');
  assert.deepEqual(await page.evaluate(() => qa.controller.selectionSnapshot()), selectionBeforeSave);
  assert.equal(await page.evaluate(() => qa.navigation), navigationBeforeSave);
  assert.equal(await page.$eval('[data-comparison="pinned"]', (element) => element.textContent), pinned);
  assert.match(await page.$eval('[data-comparison="current"]', (element) => element.textContent), /Synthetic two/);
  const beforeMarkers = await page.evaluate(() => qa.store.serializeRecords());
  await click('map-toggle'); await page.waitForFunction(() => !qa.noteLayer.state().loading);
  assert.equal(await page.evaluate(() => qa.noteLayer.state().shown), 1);
  assert.match(await page.evaluate(() => [...qa.markers.values()][0].label.text), /12:15:00.000Z/);
  assert.doesNotMatch(await page.evaluate(() => [...qa.markers.values()][0].label.text), /Private|img/);
  assert.equal(await page.evaluate(() => qa.store.serializeRecords()), beforeMarkers);
  assert.equal(await page.evaluate(() => qa.navigation), navigationBeforeSave);
  await edit('Unsaved after save');
  await page.evaluate(async () => { qa.workspace.close(); await qa.workspace.open(); }); await settle();
  assert.equal(await value(), 'Unsaved after save');
  const beforeDirector = await page.evaluate(() => qa.store.serializeRecords());
  await page.evaluate(() => { qa.directorRunning = true; document.body.classList.add('scene-playback-mode'); });
  await page.waitForFunction(() => document.querySelector('[data-role="event-notes"]').hidden);
  assert.equal(await page.evaluate(() => qa.noteLayer.state().shown), 0);
  assert.equal(await page.evaluate(() => qa.noteLayer.state().enabled), false);
  // Even synthetic dispatched clicks (which bypass disabled button semantics) are refused.
  for (const action of ['new', 'save', 'delete', 'undo', 'download', 'reload', 'map-toggle', 'map-refresh']) {
    await page.$eval(node(action), (element) => element.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  }
  assert.equal(await page.evaluate(() => qa.store.serializeRecords()), beforeDirector);
  assert.equal(await page.evaluate(() => qa.downloads.length), 0);
  await page.evaluate(async () => { await qa.workspace.applySceneView(qa.controller.shareSnapshot()); });
  assert.equal(await value(), 'Unsaved after save');
  await page.evaluate(() => { qa.directorRunning = false; document.body.classList.remove('scene-playback-mode'); }); await settle();
  assert.equal(await page.$eval('[data-role="event-notes"]', (element) => element.hidden), false);
  assert.equal(await page.$eval(node('new'), (element) => element.disabled), true, 'Scene/shared previews are not saved-source capture candidates');
  assert.equal(await page.$eval(node('map-toggle'), (element) => element.disabled), true);
  assert.equal(await page.evaluate(() => qa.noteLayer.state().enabled), false);
  assert.equal(await value(), 'Unsaved after save');
  await click('save'); assert.equal((await page.evaluate(() => qa.notes.load())).annotations[0].note, 'Unsaved after save');
  // A source check started before playback may finish, but must not replace an editor during playback.
  await page.evaluate(() => qa.workspace.selectSavedEvent('two')); await settle();
  await page.evaluate(() => { qa.holdSource = true; });
  await page.$eval(node('new'), (element) => element.click());
  await page.waitForFunction(() => typeof qa.releaseSource === 'function');
  await page.evaluate(() => { qa.directorRunning = true; document.body.classList.add('scene-playback-mode'); });
  await page.waitForFunction(() => document.querySelector('[data-role="event-notes"]').hidden);
  await page.evaluate(() => { qa.directorRunning = false; document.body.classList.remove('scene-playback-mode'); qa.holdSource = false; qa.releaseSource(); }); await settle();
  assert.equal(await value(), 'Unsaved after save');
  // Genuine document reload, same disposable profile/database; no in-memory panel state survives.
  await page.evaluate(() => { qa.workspace.destroy(); return qa.store.close(); });
  await page.reload({ waitUntil: 'domcontentloaded' }); await mount();
  assert.equal(await page.evaluate(() => qa.reads), 0);
  assert.equal(await page.evaluate(() => qa.markerReads()), 0);
  assert.equal(await page.evaluate(() => qa.noteLayer.state().enabled), false);
  await page.click('[data-action="event-notes"]'); await settle();
  await page.select(node('list'), saved.id);
  assert.equal(await value(), 'Unsaved after save');
  assert.equal(await page.$eval(node('undo'), (element) => element.disabled), true);
  assert.equal(await page.$eval(node('new'), (element) => element.disabled), true);
  assert.equal(await page.$('[data-role="event-notes"] img'), null);
  assert.match(await page.$eval('[data-role="import-review"]', (element) => element.textContent), /does not merge individual notes/);
  await page.setViewport({ width: 390, height: 844 });
  const beforeNarrowGuide = await page.evaluate(() => qa.store.serializeRecords());
  await page.focus('[data-action="quick-start"]'); await page.keyboard.press('Enter');
  assert.ok(await page.$eval('[data-role="quick-start"]', (element) => element.scrollWidth <= element.clientWidth + 1));
  assert.ok(await page.$eval('#astroeye-workspace', (element) => element.scrollWidth <= element.clientWidth + 1));
  assert.equal(await page.evaluate(() => qa.store.serializeRecords()), beforeNarrowGuide);
  await mkdir('qa-shots/astroeye-quick-start', { recursive: true });
  await page.screenshot({ path: 'qa-shots/astroeye-quick-start/narrow.png' });
  await page.$eval('[data-action="event-notes"]', (element) => element.click());
  assert.ok(await page.$eval('[data-role="event-notes"]', (element) => element.scrollWidth <= element.clientWidth + 1));
  assert.equal(await page.evaluate(async () => (await qa.store.getWorkspace('astroeye-research-notebook-v1'))?.text), 'Separate notebook sentinel');
  await click('map-toggle'); await page.waitForFunction(() => qa.noteLayer.state().shown === 1);
  await click('delete'); await page.waitForFunction(() => !qa.noteLayer.state().loading && qa.noteLayer.state().shown === 0);
  await click('undo'); await page.waitForFunction(() => qa.noteLayer.state().shown === 1);
  await page.evaluate(async () => { const backup = await qa.store.exportRecords();
    backup.workspaces = backup.workspaces.map((record) => record.kind === 'astroeye-event-annotations' ? { ...record, annotations: [] } : record);
    await qa.controller.prepareImportRecords(backup); await qa.controller.confirmImportRecords({ allowOverwrite: true });
  });
  await page.waitForFunction(() => !qa.noteLayer.state().loading && qa.noteLayer.state().shown === 0);
  await page.evaluate(() => { qa.workspace.destroy(); return qa.store.close(); });
  assert.equal(await page.evaluate(() => qa.markers.size), 0);
  assert.deepEqual(errors, []); assert.deepEqual(unexpected, []);
  report = { passed: true, keyboardEntry: true, quickStartKeyboardAndNarrowLayout: true,
    guideDoesNotReadNotesOrWriteRecords: true, comparisonPinSurvivesChartSwitchAndNoteSave: true,
    selectionChangesPreserveCapture: true, saveDoesNotNavigate: true,
    directorSuspension: true, delayedCaptureRefusedDuringPlayback: true, realReloadPersistence: true,
    narrowEditorLayout: true, separateNotebookPreserved: true, embeddedIconRequests: embeddedIcons,
    optInNoteMarkers: true, markerDeleteUndoImportRefresh: true, markersStayOffAfterPlaybackAndReload: true, markerViewerMocked: true,
    mainAppBootstrapped: false, userDataAccessed: false, liveProviderRequests: 0 };
} finally {
  try { const cleanup = await closeOwnedBrowser(browser, { page }); if (report) report.cleanup = cleanup; }
  finally { clearTimeout(watchdog); }
}
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`, () => process.exit(report?.passed && report?.cleanup.status === 'graceful' ? 0 : 1));
