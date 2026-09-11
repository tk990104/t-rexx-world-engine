import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import puppeteer from 'puppeteer';

// Isolated profile and synthetic event: never touches the user's browser records.
const browser = await puppeteer.launch({ headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
try {
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(60000);
  await page.setViewport({ width: 1360, height: 1000 });
  const errors = [];
  const pending = new Set();
  page.on('request', (request) => pending.add(request));
  page.on('requestfinished', (request) => pending.delete(request));
  page.on('requestfailed', (request) => pending.delete(request));
  page.on('error', (error) => console.error('Browser error:', error.message));
  if (process.argv.includes('--offline-fonts')) {
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const { hostname } = new URL(request.url());
      if (['fonts.googleapis.com', 'fonts.gstatic.com'].includes(hostname)) void request.abort();
      else void request.continue();
    });
  }
  page.on('pageerror', (error) => errors.push(error.message));
  const base = process.env.QA_BASE_URL || 'http://127.0.0.1:5173';
  try {
    await page.goto(`${base}/#v=2&lat=40.7128&lon=-74.006&alt=12000&heading=0&pitch=-90&roll=0&style=normal&map=osm&l=`, { waitUntil: 'domcontentloaded' });
  } catch (error) {
    console.error('Pending startup resources:', [...pending].map((request) => { const url = new URL(request.url()); return `${url.origin}${url.pathname}`; }));
    throw error;
  }
  await page.waitForFunction(() => window.__godsEyeView?.sceneDirector && document.querySelector('#loading-screen')?.classList.contains('hidden'), { timeout: 60000 });
  const click = (selector) => page.$eval(selector, (button) => button.click());
  const records = () => page.evaluate(async () => {
    const request = indexedDB.open('t-rexx-world-engine');
    const db = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const result = {};
    for (const name of ['events', 'charts']) {
      const query = db.transaction(name, 'readonly').objectStore(name).getAll();
      result[name] = await new Promise((resolve, reject) => { query.onsuccess = () => resolve(query.result); query.onerror = () => reject(query.error); });
    }
    db.close(); return result;
  });
  const project = () => page.evaluate(() => JSON.parse(localStorage.getItem('godsEyeView.sceneProject.v2')));
  const originalScenes = await page.evaluate(() => window.__godsEyeView.sceneDirector.listScenes());
  await click('#astroeye-entry-layers');
  await page.waitForSelector('#astroeye-workspace:not([hidden])');
  await page.$eval('.astroeye-form', (form) => {
    const values = { title: 'AstroEye Tour QA 🪐', sport: 'American Football', competition: 'Demo', home: 'QA Home', away: 'QA Away',
      venueName: 'QA venue', latitude: '40.7128', longitude: '-74.006', localDate: '2026-11-01', localTime: '01:30', timeZone: 'America/New_York', houseSystem: 'equal' };
    for (const [key, value] of Object.entries(values)) form.elements.namedItem(key).value = value;
    form.elements.namedItem('timeZone').dispatchEvent(new Event('change', { bubbles: true }));
    form.elements.namedItem('utcStart').value = '2026-11-01T06:30:00.000Z';
    form.requestSubmit();
  });
  await page.waitForSelector('.astroeye-chart:not([hidden]) svg');
  await page.$eval('#astroeye-time-offset', (slider) => { slider.value = '-60'; slider.dispatchEvent(new Event('change', { bubbles: true })); });
  const before = await records();
  await click('[data-action="create-tour"]');
  await page.waitForSelector('[data-action="preview-tour"]:not([hidden])');
  const saved = await project();
  assert.equal(saved.version, 4);
  assert.equal(saved.scenes.length, originalScenes.length + 1);
  const tour = saved.scenes.at(-1);
  assert.equal(tour.shots.length, 3);
  assert.equal(tour.shots[0].modules.astroeye.offsetMinutes, -60);
  assert.equal(tour.shots[0].modules.astroeye.event.utcStart, '2026-11-01T06:30:00.000Z');
  mkdirSync('qa-shots/astroeye-tour', { recursive: true });
  await page.$eval('.astroeye-tour-controls', (node) => node.scrollIntoView({ block: 'center' }));
  await page.screenshot({ path: 'qa-shots/astroeye-tour/desktop.png' });
  await page.setViewport({ width: 390, height: 844 });
  await page.$eval('.astroeye-tour-controls', (node) => node.scrollIntoView({ block: 'center' }));
  assert.ok(await page.$eval('#astroeye-workspace', (node) => node.scrollWidth <= node.clientWidth + 1));
  await page.screenshot({ path: 'qa-shots/astroeye-tour/mobile.png' });
  await page.setViewport({ width: 1360, height: 1000 });
  console.log('PASS: append, canonical scene payload, desktop/mobile controls.');
  await click('[data-action="preview-tour"]');
  await page.waitForFunction(() => window.__godsEyeView.sceneDirector.running);
  await page.waitForFunction(() => window.__godsEyeView.worldPlatform.worldClock.now().toISOString() === '2026-11-01T05:30:00.000Z');
  assert.equal(await page.$eval('#astroeye-workspace', (node) => getComputedStyle(node).visibility), 'hidden');
  await page.waitForSelector('#scene-playback-stop', { visible: true });
  await page.screenshot({ path: 'qa-shots/astroeye-tour/playback.png' });
  await page.click('#scene-playback-stop');
  await page.waitForFunction(() => !window.__godsEyeView.sceneDirector.running);
  await page.waitForFunction(() => !document.querySelector('#astroeye-workspace').dataset.busy);
  assert.equal(await page.$eval('#astroeye-workspace', (node) => getComputedStyle(node).visibility), 'visible');
  console.log('PASS: visible Stop control and cancellation cleanup.');
  // Deliberately move the current preview, then replay the saved one.
  await click('[data-action="time-forward"]');
  await click('[data-action="preview-tour"]');
  await page.waitForFunction(() => window.__godsEyeView.sceneDirector.running);
  await page.waitForFunction(() => !window.__godsEyeView.sceneDirector.running, { timeout: 60000 });
  assert.match(await page.$eval('#scene-status', (node) => node.textContent), /complete/);
  assert.match(await page.$eval('[data-time="instant"]', (node) => node.textContent), /05:30:00 UTC/);
  assert.deepEqual(await records(), before);
  assert.deepEqual(await project(), saved, 'playback does not rewrite scene storage');
  console.log('PASS: complete three-shot tour, exact preview restored, records unchanged.');
  await click('[data-action="preview-tour"]');
  await page.waitForFunction(() => window.__godsEyeView.sceneDirector.running);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !window.__godsEyeView.sceneDirector.running);
  console.log('PASS: Escape stops playback.');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__godsEyeView?.sceneDirector, { timeout: 60000 });
  await page.evaluate(async (tour) => {
    await window.__godsEyeView.styleManager.initialRestorePromise;
    await window.__godsEyeView.sceneDirector.loadShot(tour.id, tour.shots[2].id, { flyDuration: 0.2 });
  }, tour);
  await click('#astroeye-entry-layers');
  await page.waitForSelector('#astroeye-workspace:not([hidden])');
  assert.match(await page.$eval('[data-time="instant"]', (node) => node.textContent), /05:30:00 UTC/);
  assert.deepEqual(await records(), before);
  // Exercise the existing file-import seam using only this isolated fixture project.
  await page.evaluate(async (saved) => window.__godsEyeView.sceneDirector.importProjectFile(new File([JSON.stringify(saved)], 'qa-tour.json', { type: 'application/json' })), saved);
  assert.deepEqual((await project()).scenes, saved.scenes);
  assert.deepEqual(errors, []);
  console.log('PASS: reload, shot load, scene import, no record writes or page errors.');
} catch (error) {
  for (const page of await browser.pages()) {
    console.error(await page.evaluate(() => ({ url: location.href,
      loading: document.querySelector('#loading-screen .loader-status')?.textContent,
      scene: document.querySelector('#scene-status')?.textContent,
      status: document.querySelector('.astroeye-live-status')?.textContent,
      running: window.__godsEyeView?.sceneDirector?.running,
    })).catch(() => 'Page unavailable'));
  }
  throw error;
} finally { await browser.close(); }
