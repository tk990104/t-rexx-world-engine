import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';

let browser;
const deadline = setTimeout(async () => {
  console.error('AstroEye command UI check exceeded 60 seconds.');
  await Promise.race([browser?.close(), new Promise((r) => setTimeout(r, 2000))]);
  browser?.process()?.kill(); process.exit(1);
}, 60000);
try {
  browser = await puppeteer.launch({ headless: true, timeout: 15000, args: ['--disable-gpu'] });
  const page = await browser.newPage(); page.setDefaultTimeout(10000);
  const base = process.env.QA_BASE_URL || 'http://127.0.0.1:5173';
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (request.resourceType() === 'document') void request.respond({ contentType: 'text/html', body: '<html><body></body></html>' });
    else if (url.origin !== new URL(base).origin || url.pathname.startsWith('/api/')) void request.abort();
    else void request.continue();
  });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  const result = await page.evaluate(async () => {
    const { mountAstroEyeWorkspace } = await import('/src/modules/astroeye/astroeyeWorkspace.js');
    const { createAstroEyeWorkspaceController } = await import('/src/modules/astroeye/workspaceController.js');
    const { installAstroEyeWorkspaceCommands } = await import('/src/modules/astroeye/workspaceCommands.js');
    const { CommandRegistry } = await import('/src/core/commandRegistry.js');
    const { PanelRegistry } = await import('/src/core/panelRegistry.js');
    const { createWorldRecordStore } = await import('/src/core/worldRecordStore.js');
    const { EventBus } = await import('/src/core/eventBus.js');
    const { ModuleStateCoordinator } = await import('/src/core/moduleState.js');
    const { WorldClock } = await import('/src/core/worldClock.js');
    const { initFreeVoice } = await import('/src/voice/freeVoice.js');
    const { initGevVoiceCommands } = await import('/src/voice/gevRealtime.js');
    const check = (condition, message) => { if (!condition) throw new Error(message); };
    const store = createWorldRecordStore({ databaseName: 'qa-astroeye-commands-isolated' });
    const eventBus = new EventBus(), controller = createAstroEyeWorkspaceController({ recordStore: store,
      eventBus, moduleState: new ModuleStateCoordinator({ eventBus }), worldClock: new WorldClock({ eventBus }) });
    await controller.saveDraft({ id: 'qa-one', title: 'Synthetic One', sport: 'Test', competition: 'QA', home: 'A', away: 'B',
      localDate: '2026-09-09', localTime: '12:00', timeZone: 'UTC', venueName: 'Private QA venue', latitude: 40, longitude: -75, houseSystem: 'equal' });
    const before = await store.serializeRecords();
    const state = { enabled: false, focus: null, skyTime: null, allowed: true, cameraAllowed: true, flights: 0, delay: false, release: null };
    const sky = { update(chart) { state.skyTime = chart?.calculatedFor; }, isEnabled: () => state.enabled,
      setEnabled(enabled, { focus } = {}) { state.enabled = enabled; state.focus = focus; }, destroy() {} };
    const registry = new CommandRegistry(), panels = new PanelRegistry();
    const workspace = mountAstroEyeWorkspace({ controller, eventSky: sky, onRequestClose: () => panels.hide() });
    panels.register({ id: 'astroeye-workspace', title: 'AstroEye', owner: 'astroeye', mount: async (_host, options) => {
      if (!await workspace.open(undefined, options)) return false;
      return () => workspace.close();
    } });
    const installed = installAstroEyeWorkspaceCommands({ registry, panels, workspace, host: document.body,
      controller: { ...controller, listEvents: async () => {
        if (state.delay) await new Promise((r) => { state.release = r; }); return controller.listEvents();
      } }, canInteract: () => state.allowed, flyToVenue: ({ isCurrent }) => {
        if (!isCurrent() || !state.cameraAllowed) return false; state.flights++; return true;
      } });
    const run = (name, args) => registry.execute(`astroeye_${name}`, args);
    check((await run('open')).ok && !workspace.root.hidden, 'Open did not show workspace');
    check((await run('select_event', { title: 'Synthetic One' })).ok, 'Selection failed');
    check(workspace.root.querySelector('[data-chart="title"]').textContent.includes('Synthetic One'), 'Visible chart not selected');
    check((await run('preview_time', { offsetMinutes: 30 })).ok, 'Preview failed');
    check(workspace.root.querySelector('#astroeye-time-offset').value === '30', 'Visible preview slider stale');
    check(workspace.root.querySelector('[data-chart="provenance"]').textContent.includes('12:30:00'), 'Visible provenance stale');
    check((await run('event_sky', { enabled: true })).ok && state.enabled && state.focus === false, 'Sky focused or failed');
    check(state.skyTime === '2026-09-09T12:30:00.000Z', 'Sky snapshot time stale');
    const summary = await run('summarize');
    check(summary.calculation.calculatedFor === state.skyTime, 'Summary not displayed time');
    check(!JSON.stringify(summary).includes('Synthetic One'), 'Summary leaked event title');
    state.cameraAllowed = false;
    check(!(await run('fly_to_venue')).ok && state.flights === 0, 'Camera refusal ignored');
    state.cameraAllowed = true;
    check((await run('fly_to_venue')).ok && state.flights === 1, 'Explicit navigation failed');
    state.allowed = false;
    check((await run('preview_time', { offsetMinutes: 0 })).code === 'blocked', 'Director guard ignored'); state.allowed = true;
    state.delay = true;
    const pending = run('select_event', { title: 'Synthetic One' });
    workspace.root.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    state.release(); check((await pending).code === 'cancelled', 'Manual input did not cancel delayed selection'); state.delay = false;
    check(controller.selectionSnapshot().offsetMinutes === 30, 'Cancelled selection changed preview');
    check((await run('close')).ok && workspace.root.hidden && !state.enabled, 'Close did not restore sky/workspace');
    check(await store.serializeRecords() === before, 'Commands changed durable records');
    // Isolated, synthetic voice failures: no native microphone or AI requests.
    const speechSessions = [], utterances = [], voiceStates = [], requests = [];
    class MockRecognition {
      constructor() { speechSessions.push(this); this.starts = 0; }
      start() { this.starts++; } stop() {} abort() { this.onend?.(); }
    }
    const speech = { getVoices: () => [], addEventListener() {}, cancel() {}, speak: (u) => utterances.push(u.text) };
    Object.defineProperty(window, 'SpeechRecognition', { configurable: true, value: MockRecognition });
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: speech });
    const viewer = { __gevViewTargetPrewarmInstalled: true,
      clock: { onTick: { addEventListener: () => () => {} } },
      scene: { canvas: { addEventListener() {}, removeEventListener() {} } } };
    let tokenAvailable = false, microphoneAttempts = 0;
    const nativeFetch = window.fetch;
    window.fetch = async (url, options = {}) => {
      requests.push({ url: String(url), body: options.body || '' });
      if (String(url).startsWith('/api/realtime/token')) {
        return new Response(JSON.stringify(tokenAvailable ? { value: 'synthetic-token-not-a-credential' } : { error: 'QA provider not configured' }), { status: tokenAvailable ? 200 : 503 });
      }
      if (String(url) === '/api/openrouter/chat') return new Response('{}', { status: 429 });
      throw new Error('Unexpected fetch in isolated voice QA');
    };
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: {
      getUserMedia: async () => { microphoneAttempts++; throw new DOMException('QA microphone denied', 'NotAllowedError'); },
    } });
    const voice = initFreeVoice({ viewer, commandRegistry: registry });
    voice.onStateChange((status, text) => voiceStates.push({ status, text }));
    voice.setAiAvailable(false);
    await voice.handle('open astroeye');
    check(!workspace.root.hidden && requests.length === 0, 'Direct command needed an AI provider');
    await voice.handle('what can you tell me about this chart?');
    check(requests.length === 0 && voiceStates.at(-1).text.includes('NO AI MODEL'), 'Missing-provider fallback failed');
    voice.setAiAvailable(true);
    const snapshot = JSON.stringify(controller.selectionSnapshot());
    await voice.handle('what can you tell me about this chart?');
    check(JSON.stringify(controller.selectionSnapshot()) === snapshot, 'Provider failure changed chart');
    check(voiceStates.at(-1).status === 'idle', 'Provider failure stranded UI');
    check(!requests.some((r) => r.body.includes('Private QA venue') || r.body.includes('qa-one')), 'Prompt leaked saved fields');
    for (const error of ['not-allowed', 'service-not-allowed', 'audio-capture']) {
      check(voice.start(), 'Synthetic recognition failed to start');
      const session = speechSessions.at(-1);
      session.onerror({ error }); session.onend();
      check(!voice.isListening() && session.starts === 1, 'Denied speech restarted automatically');
      check(voiceStates.at(-1).status === 'error', 'Denied speech lost error state');
    }
    const realtime = initGevVoiceCommands({ viewer, commandRegistry: registry });
    realtime.debugLog = () => {};
    check(document.querySelector('#gev-voice-button').title.includes('Saved collections and notebooks are not attached'), 'Voice disclosure missing');
    await realtime.start();
    check(realtime.status === 'error' && microphoneAttempts === 0, 'Missing token did not fail before microphone');
    check(document.querySelector('#gev-voice-detail').textContent === 'VOICE UNAVAILABLE', 'Token error UI missing');
    tokenAvailable = true;
    await realtime.start();
    check(realtime.status === 'error' && microphoneAttempts === 1 && realtime.stream === null, 'Microphone denial left active resources');
    check(document.querySelector('#gev-voice-error-detail').textContent.includes('QA microphone denied'), 'Microphone error detail missing');
    // Manual chart controls still work following both failed voice paths.
    workspace.root.querySelector('[data-action="time-reset"]').click();
    check(controller.selectionSnapshot().offsetMinutes === 0, 'Voice failure disabled manual time reset');
    check(await store.serializeRecords() === before, 'Voice failures changed durable records');
    voice.stop(); realtime.stop({ removeUi: true }); window.fetch = nativeFetch;
    installed.dispose(); check(registry.list().length === 0, 'Command teardown left registrations');
    workspace.destroy(); await store.close();
    return { commands: 7, recordBytesUnchanged: true, manualCancellation: true, cameraGuard: true, uiAndSkyTimeSynchronized: true,
      simulatedVoiceFailures: true, manualUiAfterVoiceFailure: true, nativeMicrophoneUsed: false };
  });
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ ...result, browser: await browser.version(), passed: true }));
} finally { await browser?.close(); clearTimeout(deadline); }
