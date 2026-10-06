import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { resolve, extname, sep } from 'node:path';
import puppeteer from 'puppeteer';
import sharp from 'sharp';
import { closeOwnedBrowser } from './qa-owned-browser-cleanup.mjs';

// Production index/bundle and real app integration, not a replacement document.
// This server exposes only dist, never .env, source caches, or provider proxies.
const root = resolve('dist'), output = resolve('qa-shots/astroeye-full-app-notes');
const mode = process.argv.find(value => value.startsWith('--phase='))?.slice(8) || 'capture';
assert.ok(['capture', 'edit', 'reload', 'terrain'].includes(mode));
const sessionName = process.argv.find(value => value.startsWith('--session='))?.slice(10);
assert.ok(mode === 'capture' ? !sessionName : /^session-[A-Za-z0-9]+$/.test(sessionName || ''));
let session, manifest;
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.wasm': 'application/wasm' };
let browser, page, report, phase = 'startup', expectedDelete = false;
const started = Date.now(), errors = [], blocked = { external: 0, api: 0 };
let publicMapRequests = 0, publicMapResponses = 0;
const mark = value => { phase = value; console.error(JSON.stringify({ phase, elapsedMs: Date.now() - started })); };
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (req.method !== 'GET' || !file.startsWith(root + sep)) { res.writeHead(403); res.end(); return; }
    const bytes = await readFile(file);
    res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(bytes);
  } catch { res.writeHead(404); res.end(); }
});
const watchdog = setTimeout(() => {
  console.error(JSON.stringify({ failed: '60-second watchdog', phase }));
  const owned = browser?.process();
  if (owned && owned.exitCode === null && owned.signalCode === null) owned.kill();
  server.closeAllConnections(); server.close(); process.exit(1);
}, 60000);
try {
  await mkdir(output, { recursive: true });
  session = mode === 'capture' ? await mkdtemp(resolve(output, 'session-')) : resolve(output, sessionName);
  const indexHash = createHash('sha256').update(await readFile(resolve(root, 'index.html'))).digest('hex');
  manifest = mode === 'capture' ? { indexHash } : JSON.parse(await readFile(resolve(session, 'manifest.json'), 'utf8'));
  assert.equal(manifest.indexHash, indexHash, 'Production bundle changed between phases');
  if (mode === 'capture') manifest.profile = await mkdtemp(resolve(tmpdir(), 'trexx-note-'));
  assert.ok(manifest.profile.startsWith(resolve(tmpdir()) + sep + 'trexx-note-'));
  if (mode === 'reload' || mode === 'terrain') assert.equal(manifest.edited, true);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  // Keep the same isolated origin across phases so native IndexedDB can reopen.
  if (manifest.port) {
    await new Promise(resolve => server.close(resolve));
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(manifest.port, '127.0.0.1', resolve); });
  }
  manifest.port = server.address().port;
  const origin = `http://127.0.0.1:${manifest.port}`;
  browser = await puppeteer.launch({ headless: true, timeout: 15000, userDataDir: manifest.profile,
    args: ['--disable-background-networking'] });
  page = await browser.newPage(); page.setDefaultTimeout(7000);
  await page.setViewport({ width: 1024, height: 768, deviceScaleFactor: 1 });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.setBypassServiceWorker(true);
  await page.setCacheEnabled(true);
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    const url = new URL(response.url());
    if (mode === 'terrain' && response.ok() && ['tile.openstreetmap.org', 'terrain.reearth.land'].includes(url.hostname)) publicMapResponses++;
  });
  page.on('dialog', async dialog => {
    if (expectedDelete && dialog.type() === 'confirm' && dialog.message().startsWith('Delete this saved event note and any unsaved edits?')) {
      expectedDelete = false; await dialog.accept();
    } else { errors.push(`Unexpected ${dialog.type()}`); await dialog.dismiss(); }
  });
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = new URL(request.url());
    if (['data:', 'blob:'].includes(url.protocol)) return void request.continue();
    if (url.origin !== origin) {
      const publicMap = mode === 'terrain' && url.protocol === 'https:' && !url.username && !url.password && !url.port
        && ((url.hostname === 'tile.openstreetmap.org' && /^\/\d+\/\d+\/\d+\.png$/.test(url.pathname))
          || (url.hostname === 'terrain.reearth.land' && url.pathname.startsWith('/cesium-mesh/ellipsoid/')));
      if (publicMap && publicMapRequests < 256) { publicMapRequests++; return void request.continue(); }
      blocked.external++; return void request.abort();
    }
    if (url.pathname.startsWith('/api/')) {
      blocked.api++;
      return void request.respond({ status: url.pathname === '/api/openrouter/status' ? 200 : 503,
        contentType: 'application/json', body: url.pathname === '/api/openrouter/status'
          ? '{"configured":false,"realtimeConfigured":false}' : '{"error":"Offline QA"}' });
    }
    void request.continue();
  });
  await page.evaluateOnNewDocument(() => {
    window.__qaPrivate = { microphone: 0, sockets: 0 };
    if (navigator.mediaDevices) Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      configurable: true, value: async () => { window.__qaPrivate.microphone++; throw Error('QA microphone disabled'); },
    });
    window.WebSocket = class extends EventTarget {
      static CONNECTING = 0; static OPEN = 1; static CLOSING = 2; static CLOSED = 3;
      readyState = 3;
      constructor() { super(); window.__qaPrivate.sockets++; }
      send() { throw Error('QA sockets disabled'); } close() {}
    };
  });
  const open = async () => {
    await page.goto(`${origin}/?welcome=0#v=2&lat=40&lon=-75&alt=12000&heading=0&pitch=-90&roll=0&style=normal&map=osm&l=`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForFunction(() => window.__godsEyeView?.astroEyeWorkspace && document.querySelector('#loading-screen')?.classList.contains('hidden'), { timeout: 25000 });
  };
  const click = selector => page.$eval(selector, node => node.click());
  const settle = () => page.waitForFunction(() => !document.querySelector('[data-annotation="reload"]').disabled);
  const action = async name => { await click(`[data-annotation="${name}"]`); await settle(); };
  const edit = value => page.$eval('[data-role="event-notes"] textarea', (node, text) => {
    node.value = text; node.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
  const notes = () => page.evaluate(() => __godsEyeView.worldPlatform.recordStore.getWorkspace('astroeye-event-annotations-v1'));
  const durable = () => page.evaluate(async () => {
    const { events, charts } = await __godsEyeView.worldPlatform.recordStore.exportRecords(); return { events, charts };
  });
  const camera = () => page.evaluate(() => {
    const c = __godsEyeView.viewer.camera; return { position: { ...c.position }, direction: { ...c.direction }, up: { ...c.up } };
  });
  const markers = () => page.evaluate(() => __godsEyeView.viewer.entities.values.filter(e => e.id.startsWith('t-rexx-astroeye-note-')).length);
  const render = () => page.evaluate(() => new Promise(resolve => {
    const scene = __godsEyeView.viewer.scene; const off = scene.postRender.addEventListener(() => { off(); resolve(); }); scene.requestRender();
  }));
  mark('full-production-app-startup'); await open();
  assert.equal(await markers(), 0);
  await click('#astroeye-entry-layers'); await page.waitForSelector('#astroeye-workspace:not([hidden])');
  if (mode === 'reload') {
    mark('native-reload-and-explicit-reopen');
    assert.deepEqual((await notes()).annotations[0], manifest.restored);
    assert.deepEqual(await durable(), manifest.before);
    const reloadCamera = await camera();
    await page.focus('[data-action="event-notes"]'); await page.keyboard.press('Enter'); await settle();
    assert.equal(await page.evaluate(() => document.activeElement.dataset.role), 'event-notes');
    await page.select('[data-annotation="list"]', manifest.saved.id);
    await page.waitForFunction(() => document.querySelector('[data-role="event-notes"] textarea').value === 'QA PRIVATE NOTE edited');
    assert.equal(await page.$eval('[data-annotation="map-toggle"]', e => e.getAttribute('aria-pressed')), 'false');
    await page.focus('[data-role="event-notes"]'); await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.annotation), 'map-toggle');
    await page.keyboard.press('Space');
    await page.waitForFunction(() => __godsEyeView.viewer.entities.values.some(e => e.id.startsWith('t-rexx-astroeye-note-')));
    await page.keyboard.press('Space');
    await page.waitForFunction(() => !__godsEyeView.viewer.entities.values.some(e => e.id.startsWith('t-rexx-astroeye-note-')));
    assert.equal(await page.$eval('[data-annotation="map-status"]', e => e.getAttribute('role')), 'status');
    assert.match(await page.$eval('[data-role="event-notes"] textarea', e => e.closest('label').textContent), /Event note text/);
    const reloadAfterCamera = await camera();
    for (const key of ['position', 'direction', 'up']) for (const axis of ['x', 'y', 'z'])
      assert.ok(Math.abs(reloadAfterCamera[key][axis] - reloadCamera[key][axis]) <= (key === 'position' ? 1e-6 : 1e-12));
    report = { passed: true, phase: mode, nativeProfileReopened: true, persistedFrozenNote: true,
      mapOptInAfterReload: true, chartRecordsPreserved: true, keyboardEntryAndMapToggle: true, semanticLabelsAndStatus: true };
  } else {
  if (mode === 'capture') {
  assert.equal(await notes(), null);
  mark('manual-event-and-note-save');
  await page.$eval('.astroeye-form', form => {
    const fields = { title: 'QA FULL APP EVENT', sport: 'QA', competition: 'QA', home: 'A', away: 'B',
      venueName: 'Synthetic', latitude: '40', longitude: '-75', localDate: '2026-09-15', localTime: '12:00', timeZone: 'UTC', houseSystem: 'equal' };
    for (const [name, value] of Object.entries(fields)) form.elements.namedItem(name).value = value;
    form.elements.namedItem('timeZone').dispatchEvent(new Event('change', { bubbles: true })); form.requestSubmit();
  });
  await page.waitForSelector('.astroeye-chart:not([hidden]) svg');
  await page.evaluate(() => __godsEyeView.viewer.camera.cancelFlight());
  } else {
    await page.evaluate(({ id, houseSystem }) => __godsEyeView.astroEyeWorkspace.selectSavedEvent(id,
      { navigate: false, persistChart: false, houseSystem }),
    { id: manifest.saved.eventId, houseSystem: manifest.before.charts[0].options.houseSystem });
  }
  await render();
  const before = await durable(), baselineCamera = await camera();
  await click('[data-action="event-notes"]'); await settle();
  if (mode === 'capture') { await action('new'); await edit('QA PRIVATE NOTE <img src=x>'); await action('save'); }
  else { await page.select('[data-annotation="list"]', manifest.saved.id); }
  const saved = (await notes()).annotations[0];
  assert.equal(saved.chartTimeUtc, '2026-09-15T12:00:00.000Z'); assert.equal(await markers(), 0);
  await action('map-toggle');
  await page.waitForFunction(() => __godsEyeView.viewer.entities.values.some(e => e.id.startsWith('t-rexx-astroeye-note-')));
  await click('#astroeye-workspace [data-action="close"]'); await render();
  const point = await page.evaluate(() => {
    const { viewer } = __godsEyeView, entity = viewer.entities.values.find(e => e.id.startsWith('t-rexx-astroeye-note-'));
    const p = viewer.scene.cartesianToCanvasCoordinates(entity.position.getValue(viewer.clock.currentTime));
    return { x: p?.x, y: p?.y, picked: viewer.scene.pick(p)?.id?.id === entity.id, label: entity.label.text.getValue(viewer.clock.currentTime),
      labelOffsetY: entity.label.pixelOffset.getValue(viewer.clock.currentTime).y,
      eventLabelOffsets: viewer.entities.values.filter(e => e.label?.text?.getValue(viewer.clock.currentTime)?.includes('Event start'))
        .map(e => e.label.pixelOffset.getValue(viewer.clock.currentTime).y) };
  });
  assert.ok(point.picked, 'Full-app marker must be pickable'); assert.doesNotMatch(point.label, /PRIVATE|img/);
  assert.match(point.label, /2026-09-15T12:00:00.000Z/);
  assert.ok(point.labelOffsetY > 0 && point.eventLabelOffsets.length > 0 && point.eventLabelOffsets.every(y => y < 0), 'Note and event labels must occupy opposite sides of their markers');
  const shown = resolve(session, `${mode}-shown.png`), hidden = resolve(session, 'edit-hidden.png');
  await page.screenshot({ path: shown });
  const amber = async file => {
    const { data, info } = await sharp(file).extract({ left: Math.round(point.x) - 8, top: Math.round(point.y) - 8, width: 17, height: 17 }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    let count = 0;
    for (let i = 0; i < data.length; i += info.channels) if (data[i] > 210 && data[i + 1] > 140 && data[i + 1] < 230 && data[i + 2] > 40 && data[i + 2] < 165) count++;
    return count;
  };
  const visiblePixels = await amber(shown); assert.ok(visiblePixels >= 12, 'Full-app marker must have visible amber pixels');
  if (mode === 'capture') {
    Object.assign(manifest, { saved, before });
    report = { passed: true, phase: mode, manualEntry: true, noteSave: true, optInOnly: true,
      renderedVisiblePixels: visiblePixels, picked: point.picked, privateTextExcluded: true, images: { shown } };
  } else if (mode === 'terrain') {
    mark('actual-keyless-map-and-terrain');
    await page.waitForFunction(() => {
      const { viewer } = __godsEyeView;
      const e = viewer.entities.values.find(e => e.id.startsWith('t-rexx-astroeye-note-'));
      const c = viewer.scene.globe.ellipsoid.cartesianToCartographic(e.position.getValue(viewer.clock.currentTime));
      const height = viewer.scene.globe.getHeight(c);
      viewer.scene.requestRender();
      return Number.isFinite(height) && Math.abs(height) > 1 && viewer.scene.globe.tilesLoaded;
    }, { timeout: 12000, polling: 200 });
    await render(); await page.screenshot({ path: shown });
    const terrain = await page.evaluate(() => {
      const { viewer } = __godsEyeView;
      const e = viewer.entities.values.find(e => e.id.startsWith('t-rexx-astroeye-note-'));
      const position = e.position.getValue(viewer.clock.currentTime), p = viewer.scene.cartesianToCanvasCoordinates(position);
      const c = viewer.scene.globe.ellipsoid.cartesianToCartographic(position);
      const credit = document.querySelector('#cesium-credits .cesium-credit-textContainer a[href="https://www.openstreetmap.org/copyright"]');
      const bounds = credit?.getBoundingClientRect();
      return { height: viewer.scene.globe.getHeight(c), picked: viewer.scene.pick(p)?.id?.id === e.id,
        visibleCredit: !!bounds && bounds.width > 0 && bounds.height > 0 && bounds.left >= 0 && bounds.top >= 0
          && bounds.right <= innerWidth && bounds.bottom <= innerHeight && credit.checkVisibility(),
        credits: document.querySelector('#cesium-credits .cesium-credit-textContainer')?.textContent };
    });
    assert.ok(terrain.picked); assert.ok(await amber(shown) >= 12);
    assert.match(terrain.credits, /OpenStreetMap/i);
    assert.ok(terrain.visibleCredit, 'OSM credit must be on-screen without opening a popover');
    assert.ok(publicMapResponses > 0 && publicMapRequests < 256);
    assert.deepEqual(await durable(), manifest.before); assert.deepEqual((await notes()).annotations[0], manifest.restored);
    report = { passed: true, phase: mode, actualKeylessTerrain: true, terrainHeightMeters: terrain.height,
      picked: terrain.picked, renderedVisiblePixels: await amber(shown), visibleAttribution: true, recordsPreserved: true, images: { shown } };
  } else {
  mark('frozen-time-edit-delete-undo');
  await click('#astroeye-entry-layers');
  await click('[data-action="time-forward"]');
  await click('[data-action="event-notes"]'); await settle();
  await edit('QA PRIVATE NOTE edited'); await action('save');
  assert.deepEqual({ ...(await notes()).annotations[0], note: saved.note }, saved);
  expectedDelete = true; await action('delete'); assert.equal(expectedDelete, false); assert.equal(await markers(), 0);
  await click('#astroeye-workspace [data-action="close"]'); await render();
  await page.screenshot({ path: hidden }); assert.equal(await amber(hidden), 0);
  await click('#astroeye-entry-layers'); await action('undo');
  await page.waitForFunction(() => __godsEyeView.viewer.entities.values.some(e => e.id.startsWith('t-rexx-astroeye-note-')));
  const restored = (await notes()).annotations[0]; assert.equal(restored.note, 'QA PRIVATE NOTE edited');
  assert.deepEqual({ ...restored, note: saved.note }, saved);
  assert.deepEqual(await durable(), before);
  const afterCamera = await camera();
  for (const key of ['position', 'direction', 'up']) for (const axis of ['x', 'y', 'z'])
    assert.ok(Math.abs(afterCamera[key][axis] - baselineCamera[key][axis]) <= (key === 'position' ? 1e-6 : 1e-12), `Unexpected camera change: ${key}.${axis}`);
  Object.assign(manifest, { restored, edited: true });
  report = { passed: true, phase: mode, renderedVisiblePixels: visiblePixels, deleteHidesPixels: true,
    frozenCapture: true, editUndo: true, chartAndCameraPreserved: true, images: { shown, hidden } };
  }
  }
  assert.equal(await page.evaluate(() => __qaPrivate.microphone), 0);
  assert.deepEqual(errors, []);
  Object.assign(report, { fullProductionApp: true, nativeIsolatedStorage: true, browser: await browser.version(),
    embeddedBrowserVerified: false, externalTerrainImageryVerified: mode === 'terrain', blocked,
    publicMapRequests, publicMapResponses, userDataAccessed: false, session });
} catch (error) {
  report = { passed: false, phase, error: error.message, errors, blocked };
  if (page && !page.isClosed()) {
    let timer;
    try { report.startupState = await Promise.race([page.evaluate(() => ({
      appReady: !!window.__godsEyeView, loader: document.querySelector('.loader-status')?.textContent,
      loaderHidden: document.querySelector('#loading-screen')?.classList.contains('hidden'),
    })), new Promise(resolve => { timer = setTimeout(() => resolve({ unavailable: true }), 1500); })]); }
    catch { report.startupState = { unavailable: true }; } finally { clearTimeout(timer); }
  }
} finally {
  console.error(JSON.stringify({ validation: report }));
  try { (report ??= { passed: false }).cleanup = await closeOwnedBrowser(browser, { page }); }
  finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); clearTimeout(watchdog); }
}
if (report.passed && report.cleanup.status === 'graceful') {
  await writeFile(resolve(session, 'manifest.json'), JSON.stringify(manifest, null, 2));
  await writeFile(resolve(session, `${mode}-report.json`), JSON.stringify(report, null, 2));
}
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.passed && report.cleanup.status === 'graceful' ? 0 : 1;
