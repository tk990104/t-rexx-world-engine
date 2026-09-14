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
    installed.dispose(); check(registry.list().length === 0, 'Command teardown left registrations');
    workspace.destroy(); await store.close();
    return { commands: 7, recordBytesUnchanged: true, manualCancellation: true, cameraGuard: true, uiAndSkyTimeSynchronized: true };
  });
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ ...result, browser: await browser.version(), passed: true }));
} finally { await browser?.close(); clearTimeout(deadline); }
