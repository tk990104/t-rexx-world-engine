import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import puppeteer from 'puppeteer';

// Fresh browser and synthetic records only. Never attaches to the user's preview.
const browser = await puppeteer.launch({ headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(60000);
  await page.setViewport({ width: 1360, height: 1000 });
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    if (['fonts.googleapis.com', 'fonts.gstatic.com'].includes(new URL(request.url()).hostname)) void request.abort();
    else void request.continue();
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const click = (selector) => page.$eval(selector, (button) => button.click());
  const records = () => page.evaluate(() => window.__godsEyeView.worldPlatform.recordStore.serializeRecords());
  const camera = () => page.evaluate(() => window.__godsEyeView.styleManager.getCameraState());
  const assertCameraUnchanged = (actual, expected) => {
    // Cesium can renormalize Euler angles by a last-bit rounding difference.
    for (const key of Object.keys(expected)) assert.ok(Math.abs(actual[key] - expected[key]) < 1e-8, `Camera ${key} changed`);
  };
  const markerIds = () => page.evaluate(() => window.__godsEyeView.viewer.entities.values.filter((entity) => entity.id.startsWith('t-rexx-astroeye-saved-')).map((entity) => entity.id));
  const base = process.env.QA_BASE_URL || 'http://127.0.0.1:5173';
  await page.goto(`${base}/#v=2&lat=40.7128&lon=-74.006&alt=12000&heading=0&pitch=-90&roll=0&style=normal&map=osm&l=`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__godsEyeView?.worldPlatform && document.querySelector('#loading-screen').classList.contains('hidden'));
  await click('#astroeye-entry-layers');
  await page.waitForSelector('#astroeye-workspace:not([hidden])');
  for (const [title, latitude] of [['Saved map A <b>plain</b>', '40.7128'], ['Saved map B', '40.7378']]) {
    await page.$eval('.astroeye-form', (form, values) => {
      for (const [name, value] of Object.entries(values)) form.elements.namedItem(name).value = value;
      form.elements.namedItem('timeZone').dispatchEvent(new Event('change', { bubbles: true }));
      form.requestSubmit();
    }, { title, latitude, longitude: '-74.006', sport: 'Demo', competition: 'Demo', home: 'Home', away: 'Away',
      venueName: title, localDate: '2026-09-12', localTime: '12:00', timeZone: 'UTC', houseSystem: 'whole-sign' });
    await page.waitForFunction((expected) => document.querySelector('[data-chart="title"]').textContent === expected && !document.querySelector('#astroeye-workspace').dataset.busy, {}, title);
    await page.waitForFunction(() => window.__godsEyeView.viewer.scene.tweens.length === 0);
  }
  assert.deepEqual(await markerIds(), []);
  const before = await records(), pose = await camera();
  await click('[data-action="time-forward"]');
  const stateBeforeToggle = await page.evaluate(() => window.__godsEyeView.worldPlatform.moduleState.get('astroeye'));
  await click('[data-action="saved-map"]');
  await page.waitForFunction(() => document.querySelector('[data-role="saved-map-status"]').textContent.startsWith('1 additional markers'));
  assert.equal((await markerIds()).length, 1);
  assertCameraUnchanged(await camera(), pose);
  assert.deepEqual(await page.evaluate(() => window.__godsEyeView.worldPlatform.moduleState.get('astroeye')), stateBeforeToggle);
  assert.equal(await records(), before);
  // Choose a house system not saved for A; map selection must not create a new record.
  await page.$eval('[name="houseSystem"]', (input) => { input.value = 'equal'; });
  await click('[data-action="close"]');
  await page.waitForSelector('#astroeye-workspace[hidden]');
  const point = await page.evaluate(() => {
    const { viewer } = window.__godsEyeView;
    const entity = viewer.entities.values.find((entry) => entry.id.startsWith('t-rexx-astroeye-saved-'));
    const point = viewer.scene.cartesianToCanvasCoordinates(entity.position.getValue(viewer.clock.currentTime));
    const rect = viewer.scene.canvas.getBoundingClientRect();
    return { x: point.x + rect.left, y: point.y + rect.top };
  });
  mkdirSync('qa-shots/astroeye-saved-map', { recursive: true });
  await page.screenshot({ path: 'qa-shots/astroeye-saved-map/globe.png' });
  await page.mouse.click(point.x, point.y);
  await page.waitForFunction(() => !document.querySelector('#astroeye-workspace').hidden && document.querySelector('[data-chart="title"]').textContent === 'Saved map A <b>plain</b>');
  assert.match(await page.$eval('[data-chart="provenance"]', (node) => node.textContent), /equal houses/);
  assertCameraUnchanged(await camera(), pose);
  assert.equal(await records(), before);
  assert.equal((await markerIds()).length, 1);
  console.log('PASS: opt-in saved map, real marker pick, different-house chart, stable camera/time on toggle and no record writes.');
  await page.setViewport({ width: 390, height: 844 });
  await page.$eval('.astroeye-saved-map', (node) => node.scrollIntoView({ block: 'center' }));
  assert.ok(await page.$eval('.astroeye-saved-map', (node) => node.scrollWidth <= node.clientWidth + 1));
  await page.screenshot({ path: 'qa-shots/astroeye-saved-map/mobile.png' });
  await click('[data-action="saved-map"]');
  assert.deepEqual(await markerIds(), []);
  assert.equal(await page.evaluate(() => Boolean(window.__godsEyeView.viewer.entities.getById('t-rexx-astroeye-selected-event'))), true);
  await click('[data-action="saved-map"]');
  await page.waitForFunction(() => document.querySelector('[data-role="saved-map-status"]').textContent.startsWith('1 additional markers'));
  await page.setViewport({ width: 1360, height: 1000 });
  await click('[data-action="create-tour"]');
  await page.waitForSelector('[data-action="preview-tour"]:not([hidden])');
  await click('[data-action="preview-tour"]');
  await page.waitForSelector('#scene-playback-stop', { visible: true });
  await page.waitForFunction(() => !window.__godsEyeView.viewer.entities.values.some((entity) => entity.id.startsWith('t-rexx-astroeye-saved-')));
  // Let the short tour finish: on a busy software renderer it can complete
  // between a visibility check and a subsequent attempt to click Stop.
  await page.waitForFunction(() => !document.body.classList.contains('scene-playback-mode') && !document.querySelector('#astroeye-workspace').dataset.busy);
  await page.waitForFunction(() => window.__godsEyeView.viewer.entities.values.some((entity) => entity.id.startsWith('t-rexx-astroeye-saved-')));
  assert.equal(await records(), before);
  console.log('PASS: mobile controls, scoped hide, actual Director suspension/resume, unchanged records.');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__godsEyeView?.worldPlatform && document.querySelector('#loading-screen').classList.contains('hidden'));
  assert.deepEqual(await markerIds(), []);
  assert.equal(await records(), before);
  assert.deepEqual(errors, []);
  console.log('PASS: reload keeps saved records but resets map opt-in; no page errors.');
} finally { await browser.close(); }
