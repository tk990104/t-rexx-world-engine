import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { resolve, extname, sep } from 'node:path';
import puppeteer from 'puppeteer';
import { closeOwnedBrowser } from './qa-owned-browser-cleanup.mjs';
import { checkFullAppAccessibility } from './qa-astroeye-full-app-accessibility.mjs';
import { checkFullAppPerformance } from './qa-astroeye-full-app-performance.mjs';

// Full production app, isolated records, no real provider requests or user profile.
const mode = process.argv.find(x => x.startsWith('--phase='))?.slice(8) || 'workflow';
const accessibilityMode = ['keyboard-wide', 'keyboard-narrow', 'leave-warning', 'reduced-motion'].includes(mode);
const performanceMode = ['performance-100', 'performance-1000', 'performance-idle', 'performance-active'].includes(mode);
assert.ok(['workflow', 'recipient', 'provider', 'director'].includes(mode) || accessibilityMode || performanceMode);
const name = process.argv.find(x => x.startsWith('--session='))?.slice(10);
assert.ok(mode === 'workflow' ? !name : /^session-[A-Za-z0-9]+$/.test(name || ''));
const root = resolve('dist'), output = resolve('qa-shots/astroeye-full-app-workflow');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.wasm': 'application/wasm' };
let browser, page, report, session, manifest, phase = 'startup', confirmDelete = false, venueUnavailable = false;
let publicMapRequests = 0, publicMapResponses = 0;
const errors = [], calls = [], downloadEvents = [], blocked = { external: 0, api: 0 }, started = Date.now();
const mark = value => { phase = value; console.error(JSON.stringify({ phase, elapsedMs: Date.now() - started })); };
const game = { sourceEventId: '90001', title: 'Synthetic Away at Synthetic Home', home: 'Synthetic Home', away: 'Synthetic Away',
  sport: 'American Football', competition: 'NFL', utcStart: '2026-11-01T06:30:00.000Z', venueId: '9001', venueName: 'Synthetic venue', city: 'New York', status: 'NS',
  source: { kind: 'provider', provider: 'thesportsdb', sourceEventId: '90001', retrievedAt: '2026-09-10T00:00:00.000Z' } };
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
  browser?.process()?.kill(); server.closeAllConnections(); server.close(); process.exit(1);
}, 60000);
try {
  await mkdir(output, { recursive: true });
  session = mode === 'workflow' ? await mkdtemp(resolve(output, 'session-')) : resolve(output, name);
  const indexHash = createHash('sha256').update(await readFile(resolve(root, 'index.html'))).digest('hex');
  manifest = mode === 'workflow' ? { indexHash, profile: await mkdtemp(resolve(tmpdir(), 'trexx-flow-')) }
    : JSON.parse(await readFile(resolve(session, 'manifest.json'), 'utf8'));
  assert.equal(manifest.indexHash, indexHash, 'Production bundle changed between phases');
  // Performance runs use their own fresh profile and may consume a baseline
  // manifest created under a different sandbox temp root.
  assert.ok(performanceMode || manifest.profile.startsWith(resolve(tmpdir()) + sep + 'trexx-flow-'));
  await new Promise((done, reject) => { server.once('error', reject); server.listen(manifest.port || 0, '127.0.0.1', done); });
  manifest.port = server.address().port;
  const origin = `http://127.0.0.1:${manifest.port}`;
  const profile = mode === 'recipient' || mode === 'provider' || accessibilityMode || performanceMode ? await mkdtemp(resolve(tmpdir(), 'trexx-flow-')) : manifest.profile;
  browser = await puppeteer.launch({ headless: true, timeout: 15000, userDataDir: profile, args: ['--disable-background-networking'] });
  page = await browser.newPage(); page.setDefaultTimeout(7000);
  await page.setViewport({ width: 1280, height: 900 });
  await page.setBypassServiceWorker(true);
  const downloads = resolve(session, `${mode}-downloads`); await mkdir(downloads, { recursive: true });
  const client = await page.createCDPSession();
  await client.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads, eventsEnabled: true });
  client.on('Browser.downloadWillBegin', e => downloadEvents.push({ filename: e.suggestedFilename }));
  client.on('Browser.downloadProgress', e => { if (e.state !== 'inProgress') downloadEvents.push({ state: e.state }); });
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', response => {
    const url = new URL(response.url());
    if (response.ok() && ['tile.openstreetmap.org', 'terrain.reearth.land'].includes(url.hostname)) publicMapResponses++;
  });
  page.on('dialog', async dialog => {
    if (accessibilityMode && dialog.type() === 'beforeunload') return;
    if (confirmDelete && dialog.type() === 'confirm' && dialog.message().startsWith('Delete “QA U1')) {
      confirmDelete = false; await dialog.accept();
    } else { errors.push(`Unexpected ${dialog.type()}`); await dialog.dismiss(); }
  });
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = new URL(request.url());
    if (['data:', 'blob:'].includes(url.protocol)) return void request.continue();
    if (url.origin !== origin) {
      const publicMap = ['performance-idle', 'performance-active'].includes(mode) && url.protocol === 'https:' && !url.username && !url.password && !url.port
        && ((url.hostname === 'tile.openstreetmap.org' && /^\/\d+\/\d+\/\d+\.png$/.test(url.pathname))
          || (url.hostname === 'terrain.reearth.land' && url.pathname.startsWith('/cesium-mesh/ellipsoid/')));
      if (publicMap && publicMapRequests < 256) { publicMapRequests++; return void request.continue(); }
      blocked.external++; return void request.abort();
    }
    if (mode === 'provider' && url.pathname === '/api/astroeye/sports') {
      const venue = url.searchParams.has('venue'); calls.push(venue ? 'venue' : 'schedule');
      const body = venue ? (venueUnavailable ? { error: 'Synthetic venue lookup unavailable' } :
        { venue: { name: 'Synthetic venue', coordinates: { latitude: 40.7128, longitude: -74.006 }, timeZoneHint: 'Eastern time' } }) :
        { events: [game], retrievedAt: game.source.retrievedAt, access: 'free', cached: false, skipped: 0 };
      return void request.respond({ status: venue && venueUnavailable ? 502 : 200, contentType: 'application/json', body: JSON.stringify(body) });
    }
    if (url.pathname.startsWith('/api/')) {
      blocked.api++; return void request.respond({ status: url.pathname === '/api/openrouter/status' ? 200 : 503, contentType: 'application/json',
        // Exercise the installed global shortcut without enabling token/audio traffic.
        body: url.pathname === '/api/openrouter/status' ? JSON.stringify({ configured: false, realtimeConfigured: accessibilityMode }) : '{"error":"Offline QA"}' });
    }
    void request.continue();
  });
  await page.evaluateOnNewDocument(() => {
    window.__qaMedia = 0;
    if (navigator.mediaDevices) Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { configurable: true,
      value: async () => { window.__qaMedia++; throw Error('QA microphone disabled'); } });
    window.WebSocket = class extends EventTarget { static CONNECTING = 0; static OPEN = 1; static CLOSING = 2; static CLOSED = 3;
      readyState = 3; send() { throw Error('QA sockets disabled'); } close() {} };
  });
  const startUrl = mode === 'recipient' ? manifest.shareUrl : `${origin}/?welcome=0#v=2&lat=40&lon=-75&alt=12000&heading=0&pitch=-90&roll=0&style=normal&map=osm&l=`;
  assert.equal(new URL(startUrl).origin, origin);
  mark('production-app-startup');
  await page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForFunction(() => window.__godsEyeView?.astroEyeWorkspace && document.querySelector('#loading-screen')?.classList.contains('hidden'), { timeout: 25000 });
  const idle = () => page.waitForFunction(() => !__godsEyeView.astroEyeWorkspace.isBusy());
  const click = async selector => { await page.$eval(selector, n => n.click()); await idle(); };
  const action = name => click(`[data-action="${name}"]`);
  const records = () => page.evaluate(() => __godsEyeView.worldPlatform.recordStore.serializeRecords());
  const snapshot = () => page.evaluate(() => __godsEyeView.astroEyeWorkspace.sceneSnapshot());
  const camera = () => page.evaluate(() => { const c = __godsEyeView.viewer.camera; return { position: { ...c.position }, direction: { ...c.direction }, up: { ...c.up } }; });
  const setField = (name, value) => page.$eval(`[name="${name}"]`, (n, v) => { n.value = v; n.dispatchEvent(new Event('input', { bubbles: true })); n.dispatchEvent(new Event('change', { bubbles: true })); }, value);
  const field = name => page.$eval(`[name="${name}"]`, n => n.value);
  const submit = async () => { await page.$eval('.astroeye-form', f => f.requestSubmit()); await idle(); };
  const panel = async (kind, name) => { await click(`[data-${kind}="${name}"]`); await page.waitForFunction(k => !document.querySelector(`[data-${k}="reload"]`).disabled, {}, kind); };
  const text = (role, value) => page.$eval(`[data-role="${role}"] textarea`, (n, v) => { n.value = v; n.dispatchEvent(new Event('input', { bubbles: true })); }, value);
  const readDownload = async name => {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) { try { return await readFile(resolve(downloads, name), 'utf8'); } catch { await new Promise(r => setTimeout(r, 100)); } }
    throw Error(`Download did not complete: ${name}`);
  };
  const importReview = async backup => {
    await page.evaluate(value => { const dt = new DataTransfer(); dt.items.add(new File([value], 'qa-private-backup.json', { type: 'application/json' }));
      const input = document.querySelector('[data-role="import-file"]'); input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true })); }, backup);
    await page.waitForSelector('[data-role="import-review"]:not([hidden])'); await idle();
  };
  if (accessibilityMode) {
    // Open through the visible keyboard path, so Escape has a real focus origin.
    await page.focus('[data-collapse-target="data-panel"]'); await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('#astroeye-entry-layers').checkVisibility());
    await page.focus('#astroeye-entry-layers'); await page.keyboard.press('Enter'); await idle();
  } else await click('#astroeye-entry-layers');
  if (performanceMode) {
    report = await checkFullAppPerformance({ page, mode, manifest, mark });
  } else if (accessibilityMode) {
    await importReview(manifest.backup); await action('confirm-import');
    report = await checkFullAppAccessibility({ page, client, mode, session, manifest, mark, action, idle, records, readDownload });
  } else if (mode === 'workflow') {
    mark('manual-comparison-and-notes');
    const empty = await records();
    for (const [n, v] of Object.entries({ title: 'QA U1 Manual', sport: 'QA', competition: 'QA', home: 'Home', away: 'Away', venueName: 'Synthetic',
      latitude: '40', longitude: '-75', localDate: '2026-11-01', localTime: '01:30:00', timeZone: 'America/New_York', houseSystem: 'equal' })) await setField(n, v);
    await submit(); assert.equal(await records(), empty);
    await page.select('[name="utcStart"]', '2026-11-01T06:30:00.000Z'); await submit();
    await page.waitForSelector('.astroeye-chart:not([hidden]) svg');
    await page.evaluate(() => __godsEyeView.viewer.camera.cancelFlight());
    const initial = await records(); assert.equal(JSON.parse(initial).events[0].utcStart, '2026-11-01T06:30:00.000Z');
    await action('compare-charts'); await click('[data-comparison="pin"]');
    const pinned = await page.$eval('[data-comparison="pinned"]', n => n.textContent);
    await action('time-forward'); assert.equal(await records(), initial);
    await action('event-notes'); await panel('annotation', 'new'); await text('event-notes', 'QA PRIVATE U1 NOTE <img src=x>');
    await action('time-forward'); await panel('annotation', 'save');
    const note = JSON.parse(await records()).workspaces.find(x => x.id === 'astroeye-event-annotations-v1');
    assert.ok(note); assert.match(JSON.stringify(note), /06:45:00.000Z/);
    await action('research-notes'); await page.waitForFunction(() => !document.querySelector('[data-role="research-notebook"] textarea').disabled);
    await text('research-notebook', 'QA PRIVATE U1 NOTEBOOK'); await panel('note', 'save');
    assert.equal(await page.$eval('[data-comparison="pinned"]', n => n.textContent), pinned);
    assert.match(await page.$eval('[data-comparison="current"]', n => n.textContent), /07:00:00.000Z/);
    const before = await records();
    await action('compare-charts'); await page.click('[data-comparison="export"]'); const comparison = await readDownload('t-rexx-chart-comparison.txt');
    assert.match(comparison, /06:30:00.000Z/); assert.match(comparison, /07:00:00.000Z/); assert.doesNotMatch(comparison, /QA PRIVATE/);
    await action('export'); const backup = await readDownload('t-rexx-world-records.json'); assert.equal(backup, before);
    await action('export-matching'); assert.doesNotMatch(await readDownload('t-rexx-matching-events.json'), /QA PRIVATE/);
    await action('share-view'); manifest.shareUrl = await page.$eval('#astroeye-view-link', n => n.value);
    manifest.shared = await snapshot(); assert.doesNotMatch(decodeURIComponent(manifest.shareUrl), /QA PRIVATE/);
    mark('deletion-and-reviewed-recovery');
    const baseline = await camera();
    confirmDelete = true; await action('delete'); assert.equal(confirmDelete, false);
    assert.equal(JSON.parse(await records()).events.length, 0); await action('undo-delete'); assert.equal(await records(), backup);
    assert.deepEqual(await camera(), baseline);
    await click('button[data-event-id]'); await page.evaluate(() => __godsEyeView.viewer.camera.cancelFlight());
    confirmDelete = true; await action('delete'); const deleted = await records();
    await importReview(backup); assert.equal(await records(), deleted); await action('cancel-import'); assert.equal(await records(), deleted);
    await importReview(backup); await action('confirm-import'); assert.equal(await records(), backup);
    Object.assign(manifest, { backup, eventId: JSON.parse(backup).events[0].id });
    report = { passed: true, manualAmbiguity: true, comparisonFrozen: true, noteFrozen: true, notebook: true,
      browserDownloads: true, privateExportExclusion: true, deleteUndo: true, reviewCancelAndImport: true };
  } else if (mode === 'recipient') {
    mark('fresh-share-and-backup-restore');
    const empty = await records(); assert.equal(JSON.parse(empty).events.length, 0); assert.deepEqual(JSON.parse(empty).workspaces, []);
    assert.deepEqual(await snapshot(), manifest.shared);
    assert.equal(await page.$eval('[data-action="delete"]', n => n.hidden), true);
    await page.waitForSelector('.astroeye-chart:not([hidden]) svg');
    await importReview(manifest.backup); assert.equal(await records(), empty); await action('confirm-import'); assert.equal(await records(), manifest.backup);
    await page.goto(`${origin}/?welcome=0#v=2&lat=40&lon=-75&alt=12000&map=osm&l=`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__godsEyeView?.astroEyeWorkspace && document.querySelector('#loading-screen')?.classList.contains('hidden'), { timeout: 25000 });
    await click('#astroeye-entry-layers'); assert.equal(await records(), manifest.backup);
    await click('button[data-event-id]'); await action('research-notes');
    await page.waitForFunction(() => document.querySelector('[data-role="research-notebook"] textarea').value === 'QA PRIVATE U1 NOTEBOOK');
    await action('event-notes'); await panel('annotation', 'reload');
    const options = await page.$$eval('[data-annotation="list"] option', nodes => nodes.map(n => n.value).filter(Boolean));
    await page.select('[data-annotation="list"]', options[0]);
    assert.equal(await page.$eval('[data-role="event-notes"] textarea', n => n.value), 'QA PRIVATE U1 NOTE <img src=x>');
    report = { passed: true, freshShareWithoutWrite: true, exactSharedSnapshot: true, reviewedBackupRestore: true, reloadPrivateResearch: true };
  } else if (mode === 'provider') {
    mark('synthetic-provider-review');
    const empty = await records(); await click('[data-schedule="next"]'); await page.waitForSelector('[data-schedule-index="0"]');
    await click('[data-schedule-index="0"]'); await page.waitForSelector('[data-role="schedule-review"]:not([hidden])');
    assert.equal(await field('timeZone'), ''); assert.equal(await records(), empty);
    await setField('timeZone', 'America/New_York'); assert.equal(await field('utcStart'), game.utcStart);
    await submit(); assert.equal(await records(), empty);
    await click('[name="scheduleReviewed"]'); await setField('venueName', 'Reviewed synthetic venue');
    assert.equal(await page.$eval('[name="scheduleReviewed"]', n => n.checked), false);
    await click('[name="scheduleReviewed"]'); await submit(); await page.waitForSelector('.astroeye-chart:not([hidden]) svg');
    const saved = JSON.parse(await records()); assert.equal(saved.events.length, 1); assert.deepEqual(saved.events[0].source, game.source);
    venueUnavailable = true; await click('[data-schedule-index="0"]');
    await page.waitForFunction(() => document.querySelector('[data-schedule="status"]').textContent.includes('Venue lookup unavailable'));
    assert.equal(await field('latitude'), ''); await setField('timeZone', 'America/New_York'); await click('[name="scheduleReviewed"]'); await submit();
    assert.deepEqual(JSON.parse(await records()), saved);
    await action('new');
    for (const [n, v] of Object.entries({ title: 'QA U1 Fallback', home: 'Home', away: 'Away', venueName: 'Synthetic', latitude: '40', longitude: '-75', localDate: '2026-11-02', localTime: '12:00', timeZone: 'UTC' })) await setField(n, v);
    await submit(); const after = JSON.parse(await records()); assert.equal(after.events.length, 2);
    assert.equal(after.events.find(e => e.title === 'QA U1 Fallback').source.kind, 'manual');
    assert.deepEqual(calls, ['schedule', 'venue', 'venue']);
    report = { passed: true, providerReviewRequired: true, editsInvalidateApproval: true, provenance: true, failedVenueRefused: true, manualFallback: true };
  } else {
    mark('real-director-handoff');
    await page.evaluate(id => __godsEyeView.astroEyeWorkspace.selectSavedEvent(id, { navigate: false, persistChart: false, houseSystem: 'equal' }), manifest.eventId);
    await page.evaluate(() => __godsEyeView.astroEyeWorkspace.previewCommandTime(-60));
    const before = await records(), expected = await snapshot();
    const initialScenes = await page.evaluate(() => structuredClone(__godsEyeView.sceneDirector._project.scenes));
    await action('create-tour'); const project = await page.evaluate(() => localStorage.getItem('godsEyeView.sceneProject.v2'));
    const scenes = JSON.parse(project).scenes, tour = scenes.at(-1); assert.deepEqual(scenes.slice(0, -1), initialScenes); assert.equal(tour.shots.length, 3);
    const { skyEnabled: _sky, ...sceneView } = expected;
    for (const shot of tour.shots) { assert.deepEqual(shot.modules.astroeye, sceneView); assert.deepEqual(shot.layers, {}); }
    assert.doesNotMatch(project, /QA PRIVATE|workspaces|annotations|notebook/i);
    const start = async label => {
      mark(label); await page.focus('[data-action="preview-tour"]'); await page.keyboard.press('Enter');
      await page.waitForFunction(() => __godsEyeView.sceneDirector.running && document.activeElement.id === 'scene-playback-stop');
      assert.equal(await page.$eval('#astroeye-workspace', n => getComputedStyle(n).visibility), 'hidden');
      assert.equal(await page.$eval('[data-action="event-notes"]', n => n.disabled), true);
    };
    const restored = async cancelled => {
      await page.waitForFunction(() => !__godsEyeView.sceneDirector.running && !__godsEyeView.astroEyeWorkspace.isBusy(), { timeout: 26000 });
      assert.equal(await page.evaluate(() => document.activeElement.dataset.action), 'preview-tour');
      assert.equal(await page.$eval('#astroeye-workspace', n => getComputedStyle(n).visibility), 'visible');
      const telemetry = await page.evaluate(() => __godsEyeView.sceneDirector._lastRunJson);
      assert.doesNotMatch(telemetry, /QA PRIVATE|workspaces|annotations|notebook/i);
      assert.equal(JSON.parse(telemetry).wasCancelled, cancelled);
      assert.equal(await records(), before); assert.equal(await page.evaluate(() => localStorage.getItem('godsEyeView.sceneProject.v2')), project);
      assert.deepEqual(await snapshot(), expected);
    };
    await start('director-stop'); await page.click('#scene-playback-stop'); await restored(true);
    await start('director-escape'); await page.keyboard.press('Escape'); await restored(true);
    await page.evaluate(() => __godsEyeView.astroEyeWorkspace.previewCommandTime(-15));
    await start('director-full-completion'); await restored(false);
    const final = await page.evaluate(() => __godsEyeView.styleManager.getCameraState());
    assert.ok(Math.abs(final.lat - 40) < 0.01 && Math.abs(final.lon + 75) < 0.01 && Math.abs(final.alt - 12000) < 10);
    assert.match(await page.$eval('#scene-status', n => n.textContent), /complete/);
    report = { passed: true, realDirectorAndCesium: true, threeShotTour: true, stopEscapeAndCompletion: true, finalCamera: final, focusRestored: true, privateResearchExcluded: true, recordsPreserved: true };
  }
  assert.equal(await page.evaluate(() => window.__qaMedia), 0); assert.deepEqual(errors, []);
  Object.assign(report, { mode, indexHash, browser: await browser.version(), fullProductionApp: true, embeddedPreviewVerified: false,
    syntheticOnly: true, liveProviders: false, publicMapRequests, publicMapResponses, blocked, session });
} catch (error) {
  report = { passed: false, mode, phase, error: error.message, errors, blocked, downloadEvents };
  if (page && !page.isClosed()) try { report.ui = await page.evaluate(() => ({
    comparison: document.querySelector('[data-comparison="export-status"]')?.textContent,
    status: document.querySelector('.astroeye-status')?.textContent,
    keys: window.__qaKeys,
  })); } catch { /* Browser shutdown evidence is recorded below. */ }
}
finally {
  console.error(JSON.stringify({ validation: report }));
  try { (report ??= { passed: false }).cleanup = await closeOwnedBrowser(browser, { page }); }
  finally { server.closeAllConnections(); await new Promise(r => server.close(r)); clearTimeout(watchdog); }
}
if (report.passed && report.cleanup.status === 'graceful') {
  await writeFile(resolve(session, 'manifest.json'), JSON.stringify(manifest, null, 2));
  await writeFile(resolve(session, `${mode}-report.json`), JSON.stringify(report, null, 2));
}
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.passed && report.cleanup.status === 'graceful' ? 0 : 1;
