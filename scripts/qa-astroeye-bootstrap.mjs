import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';

// Real index/main/Cesium boot, fresh temporary profile, synthetic records only.
// All provider endpoints are intercepted BEFORE reaching the local proxy.
let browser, report;
const deadline = setTimeout(() => {
  console.error('Full AstroEye bootstrap check exceeded 150 seconds.');
  browser?.process()?.kill(); process.exit(1);
}, 150000);
try {
  browser = await puppeteer.launch({ headless: true, timeout: 15000,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-background-networking'] });
  const page = await browser.newPage();
  page.setDefaultTimeout(15000);
  await page.setViewport({ width: 1280, height: 900 });
  await page.setBypassServiceWorker(true);
  const base = new URL(process.env.QA_BASE_URL || 'http://127.0.0.1:5173');
  assert.ok(['127.0.0.1', 'localhost'].includes(base.hostname), 'QA requires a loopback server');
  let configured = false, statusReads = 0, voiceRequests = 0, diagnosticRequests = 0, blockedExternal = 0;
  const pageErrors = [];
  const pending = new Set();
  page.on('requestfinished', (request) => pending.delete(request));
  page.on('requestfailed', (request) => pending.delete(request));
  page.on('pageerror', (error) => pageErrors.push({ name: error.name,
    category: error.message === 'Failed to fetch' ? 'fetch-failed'
      : error.message.match(/^([A-Za-z_$][\w.$]*) is not a function$/)?.[1] || 'unclassified',
    frames: [...(error.stack || '').matchAll(/\/(?:src|node_modules)\/[\w/.-]+:\d+:\d+/g)]
      .slice(0, 4).map(([frame]) => frame) }));
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    pending.add(request);
    const url = new URL(request.url());
    if (['data:', 'blob:'].includes(url.protocol)) return void request.continue();
    if (url.origin !== base.origin) { blockedExternal++; return void request.abort(); }
    if (url.pathname === '/api/openrouter/status') {
      statusReads++;
      return void request.respond({ contentType: 'application/json',
        body: JSON.stringify({ configured: false, realtimeConfigured: configured }) });
    }
    if (url.pathname === '/api/realtime/debug-log') {
      // Local diagnostics are not token/model calls. Do not persist their body.
      diagnosticRequests++;
      return void request.respond({ status: 204 });
    }
    if (url.pathname.startsWith('/api/')) {
      if (/^\/api\/(realtime|openrouter)\//.test(url.pathname)) voiceRequests++;
      return void request.respond({ status: 503, contentType: 'application/json', body: '{"error":"Offline QA"}' });
    }
    void request.continue();
  });
  await page.evaluateOnNewDocument((appOrigin) => {
    // about:blank has no mediaDevices. Install mocks only in the app document,
    // not in the neutral document used to guarantee a genuine reload.
    if (location.origin !== appOrigin) return;
    window.__qaSpeech = { sessions: [], microphoneAttempts: 0, spoken: 0, sockets: 0 };
    class Recognition {
      constructor() { window.__qaSpeech.sessions.push(this); }
      start() {}
      stop() { this.onend?.(); }
      abort() { this.onend?.(); }
    }
    Object.defineProperty(window, 'SpeechRecognition', { configurable: true, value: Recognition });
    Object.defineProperty(window, 'webkitSpeechRecognition', { configurable: true, value: Recognition });
    // Real SpeechSynthesis is an EventTarget. An empty voice list registers a
    // voiceschanged listener during init, even before the first spoken command.
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: Object.assign(new EventTarget(), {
      cancel() {}, getVoices: () => [], speak() { window.__qaSpeech.spoken++; },
    }) });
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { configurable: true, value: async () => {
      window.__qaSpeech.microphoneAttempts++;
      throw new DOMException('QA microphone disabled', 'NotAllowedError');
    } });
    // Permit only the local dev server's Vite socket; block application feed sockets.
    const NativeWebSocket = window.WebSocket;
    window.WebSocket = class extends EventTarget {
      static CONNECTING = 0; static OPEN = 1; static CLOSING = 2; static CLOSED = 3;
      readyState = 3;
      constructor(url, protocols) {
        super();
        const parsed = new URL(url, location.href);
        if (parsed.host === location.host && protocols === 'vite-hmr') return new NativeWebSocket(url, protocols);
        window.__qaSpeech.sockets++;
      }
      send() { throw new Error('QA sockets disabled'); }
      close() {}
    };
  }, base.origin);
  const open = async () => {
    const started = Date.now();
    // The app rewrites its fragment while navigating. Returning to our initial
    // fragment can be a same-document navigation; force a new document so the
    // second configuration actually boots (while preserving this QA profile's DB).
    await page.goto('about:blank', { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.goto(`${base.origin}/?welcome=0#v=2&lat=40&lon=-75&alt=12000&heading=0&pitch=-90&roll=0&style=normal&map=osm&l=`,
      { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(async (error) => {
        console.error(JSON.stringify({ loadingFailure: error.name, pageErrors,
          pendingLocalPaths: [...pending].filter((r) => new URL(r.url()).origin === base.origin)
            .slice(0, 10).map((r) => new URL(r.url()).pathname),
          state: await page.evaluate(() => ({ ready: document.readyState, app: !!window.__godsEyeView })) }));
        throw error;
      });
    await page.waitForFunction(() => window.__godsEyeView?.freeVoice
      && document.querySelector('#loading-screen')?.classList.contains('hidden'), { timeout: 25000 }).catch(async (error) => {
        console.error(JSON.stringify({ readinessFailure: error.name, pageErrors,
          state: await page.evaluate(() => ({ ready: document.readyState,
            app: !!window.__godsEyeView, voice: !!window.__godsEyeView?.freeVoice,
            loaderHidden: document.querySelector('#loading-screen')?.classList.contains('hidden'),
            loaderError: document.querySelector('.loader-status')?.textContent.startsWith('Error:') })) }));
        throw error;
      });
    console.log(JSON.stringify({ stage: 'app-ready', configuration: configured ? 'realtime' : 'browser-voice', elapsedMs: Date.now() - started }));
  };
  const click = (selector) => page.$eval(selector, (node) => node.click());
  const records = () => page.evaluate(() => window.__godsEyeView.worldPlatform.recordStore.serializeRecords());
  await open();
  await page.waitForSelector('#gev-voice-control[data-transport="free"]');
  assert.equal(voiceRequests, 0, 'Startup attempted a voice provider endpoint');
  assert.equal(await page.evaluate(() => window.__qaSpeech.sessions.length), 0, 'Startup started recognition');
  await click('#astroeye-entry-layers');
  await page.waitForSelector('#astroeye-workspace:not([hidden])');
  await page.$eval('.astroeye-form', (form) => {
    const values = { title: 'Bootstrap Synthetic', sport: 'QA', competition: 'QA', home: 'A', away: 'B',
      venueName: 'Synthetic private venue', latitude: '40', longitude: '-75',
      localDate: '2026-09-09', localTime: '12:00', timeZone: 'UTC', houseSystem: 'equal' };
    for (const [name, value] of Object.entries(values)) form.elements.namedItem(name).value = value;
    form.elements.namedItem('timeZone').dispatchEvent(new Event('change', { bubbles: true }));
    form.requestSubmit();
  });
  await page.waitForSelector('.astroeye-chart:not([hidden]) svg');
  const before = await records();
  const commandResults = await page.evaluate(async () => {
    const { worldPlatform, freeVoice, viewer } = window.__godsEyeView;
    const run = (name, args = {}) => worldPlatform.commandRegistry.execute(`astroeye_${name}`, args);
    const results = [];
    results.push(await run('select_event', { title: 'Bootstrap Synthetic' }));
    results.push(await run('preview_time', { offsetMinutes: 15 }));
    results.push(await run('event_sky', { enabled: true }));
    const summary = await run('summarize');
    results.push(summary);
    results.push(await run('event_sky', { enabled: false }));
    document.body.classList.add('scene-playback-mode');
    const blocked = await run('fly_to_venue');
    document.body.classList.remove('scene-playback-mode');
    results.push(await run('fly_to_venue'));
    viewer.camera.cancelFlight();
    results.push(await run('close'));
    const closed = document.querySelector('#astroeye-workspace').hidden;
    results.push(await run('open'));
    await freeVoice.handle('close astroeye');
    const voiceClosed = document.querySelector('#astroeye-workspace').hidden;
    await freeVoice.handle('open astroeye');
    return { codes: results.map((r) => r.code), blocked: blocked.code, closed, voiceClosed,
      reopened: !document.querySelector('#astroeye-workspace').hidden, calculation: summary.calculation };
  });
  assert.ok(commandResults.codes.every((code) => code === 'ok'), JSON.stringify(commandResults.codes));
  assert.equal(commandResults.blocked, 'blocked');
  assert.ok(commandResults.closed && commandResults.voiceClosed && commandResults.reopened);
  assert.equal(commandResults.calculation.calculatedFor, '2026-09-09T12:15:00.000Z');
  assert.equal(await page.$eval('#astroeye-time-offset', (node) => node.value), '15');
  await click('#gev-voice-button');
  await page.waitForSelector('#gev-voice-button[aria-pressed="true"]');
  await page.evaluate(() => window.__qaSpeech.sessions.at(-1).onerror({ error: 'not-allowed' }));
  await page.waitForSelector('#gev-voice-control[data-status="error"]');
  assert.equal(await page.evaluate(() => window.__godsEyeView.freeVoice.isListening()), false);
  await click('#astroeye-workspace [data-action="time-reset"]');
  await page.waitForFunction(() => document.querySelector('#astroeye-time-offset').value === '0');
  await click('#gev-voice-button');
  await page.waitForSelector('#gev-voice-button[aria-pressed="true"]');
  await click('#gev-voice-button');
  assert.equal(await records(), before, 'Commands/voice failure/manual reset changed durable records');
  assert.equal(await page.evaluate(() => window.__qaSpeech.microphoneAttempts), 0);
  assert.equal(voiceRequests, 0, 'Offline local commands attempted a voice provider request');

  // Reload the actual app with Realtime configured; never click its MIC.
  configured = true;
  const previousReads = statusReads;
  // Observe the response directly: the resource-timing buffer can fill with
  // startup modules before this fetch and is not a reliable completion signal.
  const configurationResponse = page.waitForResponse((response) =>
    new URL(response.url()).origin === base.origin
    && new URL(response.url()).pathname === '/api/openrouter/status', { timeout: 60000 }).catch(() => null);
  await open();
  await page.waitForFunction(() => !!window.__godsEyeView.voiceCommands.ui.button);
  const configuration = await configurationResponse;
  assert.ok(configuration, 'Configured startup did not read status');
  assert.deepEqual(await configuration.json(), { configured: false, realtimeConfigured: true });
  assert.ok(statusReads > previousReads);
  assert.equal(await page.evaluate(() => document.querySelector('#gev-voice-button')
    === window.__godsEyeView.voiceCommands.ui.button), true);
  assert.notEqual(await page.$eval('#gev-voice-control', (node) => node.dataset.transport), 'free');
  assert.equal(await page.evaluate(() => window.__qaSpeech.sessions.length), 0);
  assert.equal(await page.evaluate(() => window.__qaSpeech.microphoneAttempts), 0);
  assert.equal(await records(), before, 'Reload changed saved synthetic bytes');
  assert.equal(voiceRequests, 0, 'Configured startup minted a token or contacted a model');
  assert.deepEqual(pageErrors, [], 'Uncaught page errors (names only)');
  report = { passed: true, fullBootstrap: true, configurations: 2, commands: 7,
    syntheticRecordsUnchanged: true, manualRecovery: true, voiceProviderRequests: voiceRequests,
    nativeMicrophoneUsed: false, diagnosticRequestsIntercepted: diagnosticRequests,
    externalRequestsBlocked: blockedExternal, browser: await browser.version() };
} finally {
  let timer;
  const closed = await Promise.race([browser?.close().then(() => true, () => false),
    new Promise((resolve) => { timer = setTimeout(() => resolve(false), 3000); })]);
  clearTimeout(timer); clearTimeout(deadline);
  if (!closed && browser) { browser.process()?.kill(); if (report) report.browserCleanupForced = true; }
}
console.log(JSON.stringify(report, null, 2));
