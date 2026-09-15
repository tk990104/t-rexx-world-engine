import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/** Extends the owned synthetic provider workspace; no independent browser/session. */
export async function checkDirectorWorkflow(page, mark) {
  mark('director-mount');
  // Load only the actual playback visibility rules, not global fonts/live assets.
  const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
  const rules = ['#scene-playback-stop', 'body.scene-playback-mode #scene-playback-stop',
    'body.scene-playback-mode #astroeye-workspace'].map((selector) => {
    const start = css.indexOf(`${selector} {`);
    assert.ok(start >= 0, `Missing production rule: ${selector}`);
    return css.slice(start, css.indexOf('}', start) + 1);
  });
  await page.addStyleTag({ content: rules.join('\n') });
  await page.evaluate(async () => {
    const { SceneDirector } = await import('/src/scenes/director.js');
    const { createAstroEyeTour, normalizeAstroEyeSceneView } = await import('/src/modules/astroeye/directorRecipe.js');
    const { mountAstroEyeWorkspace } = await import('/src/modules/astroeye/astroeyeWorkspace.js');
    qa.workspace.destroy();
    const fixture = document.createElement('div');
    fixture.innerHTML = '<select id="scene-select" aria-label="Synthetic Director scene"></select><p id="scene-status"></p><button id="scene-playback-stop" type="button" disabled>Stop preview · Esc</button>';
    document.body.append(fixture);
    qa.flights = []; qa.recording = []; qa.layerChanges = [];
    const viewer = { camera: {
      flyTo(options) { qa.flights.push({ duration: options.duration, destination: options.destination }); queueMicrotask(() => options.complete()); },
      cancelFlight() {},
    } };
    const style = { runImmediateNavigation: (_noun, navigate) => navigate(),
      applyVisualState: async () => true, setRecordingMode: (value) => qa.recording.push(value),
      getContextModeState: () => ({ mode: null, entering: null }),
      getCameraState: () => ({ lat: 0, lon: 0, alt: 1000, heading: 0, pitch: -40, roll: 0 }),
      getVisualState: () => ({ style: 'normal' }) };
    const data = { getAll: () => [], getLayerParams: () => null,
      setEnabled: async (...args) => { qa.layerChanges.push(args); return true; }, setLayerParams() {} };
    qa.director = new SceneDirector(viewer, style, data);
    qa.initialScenes = structuredClone(qa.director._project.scenes);
    qa.workspace = mountAstroEyeWorkspace({ controller: qa.controller, researchAnnotations: qa.notes, researchNotebook: qa.notebook,
      canUseResearchAnnotations: () => !qa.director.running && !document.body.classList.contains('scene-playback-mode'),
      onCreateTour: (snapshot) => qa.director.addScene(createAstroEyeTour(snapshot)),
      onPreviewTour: async (id) => (qa.runResult = await qa.director.startScene(id, { single: true })) });
    qa.director.registerModuleAdapter('astroeye', { normalize: normalizeAstroEyeSceneView,
      capture: () => qa.workspace.sceneSnapshot(), apply: (snapshot, options) => qa.workspace.applySceneView(snapshot, options) });
    await qa.workspace.open();
    const event = (await qa.controller.listEvents()).find((event) => event.source.kind === 'provider');
    await qa.workspace.selectSavedEvent(event.id);
    qa.workspace.previewCommandTime(-60);
  });
  const records = () => page.evaluate(() => qa.store.serializeRecords());
  const project = () => page.evaluate(() => localStorage.getItem('godsEyeView.sceneProject.v2'));
  const idle = () => page.waitForFunction(() => !qa.director.running && !qa.workspace.isBusy());
  const before = await records();
  const expected = await page.evaluate(() => qa.controller.shareSnapshot());
  assert.equal(expected.offsetMinutes, -60);
  assert.match(before, /PRIVATE-SYNTHETIC-PROVIDER/);
  await page.$eval('[data-action="create-tour"]', (node) => node.click()); await idle();
  await page.waitForSelector('[data-action="preview-tour"]:not([hidden])');
  const savedProject = await project(), saved = JSON.parse(savedProject), tour = saved.scenes.at(-1);
  assert.deepEqual(saved.scenes.slice(0, -1), await page.evaluate(() => qa.initialScenes));
  assert.equal(tour.shots.length, 3);
  for (const shot of tour.shots) {
    const { skyEnabled: _sky, ...sceneView } = expected;
    assert.deepEqual(shot.modules.astroeye, sceneView);
    assert.deepEqual(shot.layers, {});
  }
  assert.doesNotMatch(savedProject, /PRIVATE-SYNTHETIC|workspaces|annotations|notebook/i);
  assert.equal(await records(), before);
  const start = async (phase) => {
    mark(phase);
    const count = await page.evaluate(() => qa.flights.length);
    await page.focus('[data-action="preview-tour"]'); await page.keyboard.press('Enter');
    await page.waitForFunction((previous) => qa.director.running && qa.flights.length > previous, {}, count);
    assert.equal(await page.$eval('#astroeye-workspace', (node) => getComputedStyle(node).visibility), 'hidden');
    assert.equal(await page.$eval('#scene-playback-stop', (node) => !node.disabled && getComputedStyle(node).display !== 'none'), true);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'scene-playback-stop');
    assert.equal(await page.$eval('[data-action="event-notes"]', (node) => node.disabled), true);
  };
  const restored = async (cancelled) => {
    await idle();
    assert.equal(await page.$eval('#astroeye-workspace', (node) => !node.hidden && getComputedStyle(node).visibility !== 'hidden'), true);
    assert.equal(await page.evaluate(() => document.activeElement.dataset.action), 'preview-tour');
    assert.equal(await page.evaluate(() => qa.runResult.cancelled), cancelled);
    assert.equal(await page.evaluate(() => qa.runResult.completed), !cancelled);
    assert.equal(await page.evaluate(() => qa.controller.selectionSnapshot().chart.calculatedFor), '2026-11-01T05:30:00.000Z');
    assert.equal(await records(), before); assert.equal(await project(), savedProject);
  };
  await start('director-stop'); await page.click('#scene-playback-stop'); await restored(true);
  await start('director-escape'); await page.keyboard.press('Escape'); await restored(true);
  // Change the current preview; saved tour must restore its own frozen instant.
  await page.evaluate(() => qa.workspace.previewCommandTime(-15));
  const flightStart = await page.evaluate(() => qa.flights.length);
  await start('director-completion'); await restored(false);
  assert.equal(await page.evaluate(() => qa.flights.length), flightStart + 3);
  assert.deepEqual(await page.evaluate(() => qa.recording), [true, false, true, false, true, false]);
  assert.deepEqual(await page.evaluate(() => qa.layerChanges), []);
  assert.doesNotMatch(await page.evaluate(() => qa.director._lastRunJson), /PRIVATE-SYNTHETIC|workspaces|annotations|notebook/i);
  assert.match(await page.$eval('#scene-status', (node) => node.textContent), /complete/);
  return { passed: true, threeShotHandoff: true, stopAndEscape: true, focusRestored: true,
    frozenTimeRestored: true, privateResearchExcluded: true, recordsAndProjectUnchanged: true,
    cameraAndStyleSimulated: true, productionVisibilityRulesOnly: true, realGlobeVerified: false };
}
