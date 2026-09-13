import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';

let browser;
const deadline = setTimeout(async () => {
  console.error('Angle-caution UI check exceeded its 60-second budget.');
  await Promise.race([browser?.close(), new Promise((resolve) => setTimeout(resolve, 2000))]);
  browser?.process()?.kill(); process.exit(1);
}, 60000);
try {
  browser = await puppeteer.launch({ headless: true, timeout: 15000, args: ['--disable-gpu'] });
  const page = await browser.newPage();
  page.setDefaultTimeout(10000);
  const base = process.env.QA_BASE_URL || 'http://127.0.0.1:5173';
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    if (request.resourceType() === 'document') void request.respond({ contentType: 'text/html', body: '<html><body></body></html>' });
    else if (new URL(request.url()).origin !== new URL(base).origin) void request.abort();
    else void request.continue();
  });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    const { mountAstroEyeWorkspace } = await import('/src/modules/astroeye/astroeyeWorkspace.js');
    const { createAstroEyeWorkspaceController, eventFromDraft } = await import('/src/modules/astroeye/workspaceController.js');
    const { calculateAstroEyeChart } = await import('/src/modules/astroeye/calculation/chart.js');
    const { createWorldRecordStore } = await import('/src/core/worldRecordStore.js');
    const { EventBus } = await import('/src/core/eventBus.js');
    const { ModuleStateCoordinator } = await import('/src/core/moduleState.js');
    const { WorldClock } = await import('/src/core/worldClock.js');
    const eventBus = new EventBus(), recordStore = createWorldRecordStore({ databaseName: 'qa-angle-caution-isolated' });
    const controller = createAstroEyeWorkspaceController({ recordStore, eventBus,
      moduleState: new ModuleStateCoordinator({ eventBus }), worldClock: new WorldClock({ eventBus }) });
    for (const [id, latitude] of [['polar', 80], ['ordinary', 40]]) {
      const event = eventFromDraft({ id, title: id, sport: 'Synthetic', competition: 'QA', home: 'A', away: 'B',
        localDate: '2026-09-13', localTime: '12:00', timeZone: 'UTC', venueName: 'Test only', latitude, longitude: 12.345678 });
      await recordStore.saveEventWithChart(event, calculateAstroEyeChart(event, { calculationVersion: 1 }));
    }
    const downloads = [];
    const [legacy] = await recordStore.listCharts({ eventId: 'ordinary' });
    delete legacy.calculationVersion;
    await recordStore.saveChart(legacy);
    const workspace = mountAstroEyeWorkspace({ controller, downloadComparison: (value) => downloads.push(value) });
    await workspace.open();
    const before = await recordStore.serializeRecords();
    await workspace.selectSavedEvent('polar');
    window.angleQA = { workspace, controller, recordStore, downloads, before };
  });
  const warning = '[data-chart="angle-caution"]';
  assert.match(await page.$eval(warning, (node) => node.textContent), /provisional/);
  assert.equal(await page.$eval(warning, (node) => node.hidden), false);
  assert.match(await page.$eval('[data-chart="provenance"]', (node) => node.textContent), /calculation model 1/);
  await page.$eval('[data-comparison="pin"]', (node) => node.click());
  await page.evaluate(() => window.angleQA.workspace.selectSavedEvent('ordinary'));
  assert.equal(await page.$eval(warning, (node) => node.hidden), true);
  assert.equal(await page.$eval(warning, (node) => node.textContent), '');
  assert.match(await page.$eval('[data-chart="provenance"]', (node) => node.textContent), /calculation model 1 \(legacy untagged chart\)/);
  assert.match(await page.$eval('[data-comparison="pinned"]', (node) => node.textContent), /calculation model 1/);
  assert.match(await page.$eval('[data-comparison="warning"]', (node) => node.textContent), /Pinned snapshot — High-latitude/);
  await page.$eval('[data-comparison="export"]', (node) => node.click());
  const report = await page.evaluate(() => window.angleQA.downloads.at(-1));
  assert.match(report, /Pinned snapshot — High-latitude/);
  assert.equal(report.split('Calculation model: 1').length - 1, 2);
  assert.ok(!report.includes('12.345678'));
  await page.evaluate(() => window.angleQA.workspace.selectSavedEvent('polar'));
  for (const width of [390, 1280]) {
    await page.setViewport({ width, height: 844 });
    assert.ok(await page.$eval(warning, (node) => !node.hidden && node.scrollWidth <= node.clientWidth + 1));
    await page.$eval('#astroeye-workspace', (node) => { node.dataset.skyCompact = 'true'; });
    assert.ok(await page.$eval(warning, (node) => node.getClientRects().length > 0 && getComputedStyle(node).display !== 'none' && node.scrollWidth <= node.clientWidth + 1));
    await page.$eval('#astroeye-workspace', (node) => { delete node.dataset.skyCompact; });
  }
  await page.evaluate(async () => {
    window.angleQA.workspace.close(); await window.angleQA.workspace.open();
  });
  assert.equal(await page.$eval(warning, (node) => node.hidden), false);
  assert.equal(await page.evaluate(async () => (await window.angleQA.recordStore.serializeRecords()) === window.angleQA.before), true);
  // Exercise actual form submission and rendering for a new model 3 polar chart.
  await page.evaluate(async () => {
    const Astronomy = await import('/node_modules/astronomy-engine/esm/astronomy.js');
    const date = new Date('2026-09-13T12:00:00Z');
    const longitude = ((270 - Astronomy.SiderealTime(date) * 15 + 540) % 360) - 180;
    window.angleQA.boundaryLatitude = 90 - Astronomy.e_tilt(Astronomy.MakeTime(date)).tobl;
    const form = document.querySelector('.astroeye-form');
    for (const [name, value] of Object.entries({ title: 'Modern polar test', sport: 'Synthetic', competition: 'QA',
      home: 'A', away: 'B', localDate: '2026-09-13', localTime: '12:00', timeZone: 'UTC',
      venueName: 'Test only', latitude: 80, longitude })) form.elements.namedItem(name).value = value;
    form.requestSubmit();
  });
  await page.waitForFunction(() => document.querySelector('[data-chart="provenance"]').textContent.includes('calculation model 3'));
  assert.match(await page.$eval('[data-comparison="warning"]', (node) => node.textContent), /model versions/);
  assert.equal(await page.$eval('[data-comparison="export"]', (node) => node.disabled), true);
  await page.$eval('[data-comparison="pin"]', (node) => node.click());
  await page.$eval('[data-comparison="export"]', (node) => node.click());
  assert.equal((await page.evaluate(() => window.angleQA.downloads.at(-1))).split('Calculation model: 3').length - 1, 2);
  await page.evaluate(async () => {
    window.angleQA.modernBefore = await window.angleQA.recordStore.serializeRecords();
    window.angleQA.selectionBefore = JSON.stringify(window.angleQA.controller.selectionSnapshot());
    const form = document.querySelector('.astroeye-form');
    form.elements.namedItem('title').value = 'Unavailable boundary';
    form.elements.namedItem('latitude').value = window.angleQA.boundaryLatitude;
    form.requestSubmit();
  });
  await page.waitForFunction(() => document.querySelector('.astroeye-live-status').textContent.includes('Angles unavailable'));
  assert.equal(await page.evaluate(async () => (await window.angleQA.recordStore.serializeRecords()) === window.angleQA.modernBefore), true);
  assert.equal(await page.evaluate(() => JSON.stringify(window.angleQA.controller.selectionSnapshot()) === window.angleQA.selectionBefore), true);
  assert.match(await page.$eval('[data-chart="provenance"]', (node) => node.textContent), /calculation model 3/);
  await page.evaluate(async () => {
    await window.angleQA.controller.saveDraft({ id: 'hour-boundary', title: 'Synthetic hour edge',
      sport: 'Demo', competition: 'QA', home: 'A', away: 'B', localDate: '2024-03-10',
      localTime: '12:07:50', timeZone: 'America/New_York', venueName: 'Synthetic',
      latitude: 40.7128, longitude: -74.006 });
    await window.angleQA.workspace.selectSavedEvent('hour-boundary');
    window.angleQA.hourBefore = await window.angleQA.recordStore.serializeRecords();
  });
  const hourNotice = '[data-chart="planetary-hour-notice"]';
  assert.equal(await page.$eval('[data-chart="planetary-hour"]', (node) => node.textContent), 'Boundary uncertain');
  assert.equal(await page.$eval(hourNotice, (node) => node.dataset.uncertain), 'true');
  await page.$eval('[data-action="time-forward"]', (node) => node.click());
  await page.waitForFunction(() => document.querySelector('[data-chart="planetary-hour-notice"]').dataset.uncertain === 'false');
  assert.match(await page.$eval(hourNotice, (node) => node.textContent), /estimates/);
  await page.$eval('[data-action="time-reset"]', (node) => node.click());
  await page.waitForFunction(() => document.querySelector('[data-chart="planetary-hour-notice"]').dataset.uncertain === 'true');
  await page.evaluate(async () => { window.angleQA.workspace.close(); await window.angleQA.workspace.open(); });
  assert.equal(await page.$eval('[data-chart="planetary-hour"]', (node) => node.textContent), 'Boundary uncertain');
  for (const width of [390, 1280]) {
    await page.setViewport({ width, height: 844 });
    assert.ok(await page.$eval(hourNotice, (node) => node.getClientRects().length > 0 && node.scrollWidth <= node.clientWidth + 1));
  }
  assert.equal(await page.evaluate(async () => (await window.angleQA.recordStore.serializeRecords()) === window.angleQA.hourBefore), true);
  assert.match(await page.$eval('[data-role="date-range"]', (node) => node.textContent), /1900–2100 UTC/);
  await page.evaluate(async () => {
    window.angleQA.rangeBefore = await window.angleQA.recordStore.serializeRecords();
    window.angleQA.rangeSelection = JSON.stringify(window.angleQA.controller.selectionSnapshot());
    const form = document.querySelector('.astroeye-form');
    for (const [name, value] of Object.entries({ localDate: '2101-01-01', localTime: '12:00', timeZone: 'UTC', latitude: 40, longitude: -75 })) {
      const node = form.elements.namedItem(name); node.value = value; node.dispatchEvent(new Event('input', { bubbles: true }));
    }
    form.requestSubmit();
  });
  await page.waitForFunction(() => document.querySelector('.astroeye-live-status').textContent.includes('outside 1900–2100 UTC'));
  assert.equal(await page.evaluate(async () => (await window.angleQA.recordStore.serializeRecords()) === window.angleQA.rangeBefore), true);
  assert.equal(await page.evaluate(() => JSON.stringify(window.angleQA.controller.selectionSnapshot()) === window.angleQA.rangeSelection), true);
  // Synthetic archival chart checks only display/storage behavior, not old-date math.
  await page.evaluate(async () => {
    const current = window.angleQA.controller.selectionSnapshot();
    const oldEvent = structuredClone(current.event);
    oldEvent.id = 'range-archive'; oldEvent.utcStart = '1899-12-31T12:00:00.000Z';
    oldEvent.scheduledLocal = { date: '1899-12-31', time: '12:00:00', timeZone: 'UTC' };
    const oldChart = { ...structuredClone(current.chart), eventId: oldEvent.id, chartId: 'range-archive-chart', calculatedFor: oldEvent.utcStart };
    await window.angleQA.recordStore.saveEventWithChart(oldEvent, oldChart);
    window.angleQA.archiveBefore = await window.angleQA.recordStore.serializeRecords();
    await window.angleQA.workspace.selectSavedEvent(oldEvent.id);
  });
  const rangeNotice = '[data-chart="date-range-caution"]';
  assert.match(await page.$eval(rangeNotice, (node) => node.textContent), /Stored values are unchanged/);
  for (const width of [390, 1280]) {
    await page.setViewport({ width, height: 844 });
    assert.ok(await page.$eval(rangeNotice, (node) => !node.hidden && node.scrollWidth <= node.clientWidth + 1));
  }
  await page.evaluate(async () => window.angleQA.workspace.selectSavedEvent('hour-boundary'));
  assert.equal(await page.$eval(rangeNotice, (node) => node.hidden), true);
  assert.equal(await page.$eval(rangeNotice, (node) => node.textContent), '');
  assert.equal(await page.evaluate(async () => (await window.angleQA.recordStore.serializeRecords()) === window.angleQA.archiveBefore), true);
  assert.deepEqual(errors, []);
  await page.evaluate(() => window.angleQA.workspace.destroy());
  console.log('PASS: legacy/model 3 compatibility, polar/hour cautions, date-range refusal/archive notices, layouts, and record preservation.');
} finally {
  try { await browser?.close(); } finally { clearTimeout(deadline); }
}
