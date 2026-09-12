import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';

// Real workspace, controller and isolated IndexedDB; no globe, live feeds or user data.
let browser;
const deadline = setTimeout(async () => {
  console.error('Import UI check exceeded its 60-second budget.');
  await Promise.race([browser?.close(), new Promise((resolve) => setTimeout(resolve, 2000))]);
  browser?.process()?.kill();
  process.exit(1);
}, 60000);
try {
  browser = await puppeteer.launch({ headless: true, timeout: 15000, args: ['--disable-gpu'] });
  const page = await browser.newPage();
  page.setDefaultTimeout(10000);
  await page.setViewport({ width: 390, height: 844 });
  const base = process.env.QA_BASE_URL || 'http://127.0.0.1:5173';
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    if (request.resourceType() === 'document') void request.respond({ contentType: 'text/html', body: '<html><head></head><body style="background:#080d19"></body></html>' });
    else if (new URL(request.url()).origin !== new URL(base).origin) void request.abort();
    else void request.continue();
  });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    const { mountAstroEyeWorkspace } = await import('/src/modules/astroeye/astroeyeWorkspace.js');
    const { createAstroEyeWorkspaceController } = await import('/src/modules/astroeye/workspaceController.js');
    const { createWorldRecordStore } = await import('/src/core/worldRecordStore.js');
    const { EventBus } = await import('/src/core/eventBus.js');
    const { ModuleStateCoordinator } = await import('/src/core/moduleState.js');
    const { WorldClock } = await import('/src/core/worldClock.js');
    const eventBus = new EventBus();
    const recordStore = createWorldRecordStore({ databaseName: 'qa-import-isolated' });
    const controller = createAstroEyeWorkspaceController({ recordStore, eventBus,
      moduleState: new ModuleStateCoordinator({ eventBus }), worldClock: new WorldClock({ eventBus }) });
    await controller.saveDraft({ id: 'original', title: 'Original', sport: 'Demo', competition: 'Cup', home: 'Home', away: 'Away',
      localDate: '2026-09-09', localTime: '20:15', timeZone: 'America/New_York', venueName: 'Arena', latitude: 40.75, longitude: -73.99 });
    const before = await recordStore.serializeRecords();
    const incoming = JSON.parse(before);
    incoming.events[0].title = 'Imported title';
    incoming.events.push({ ...incoming.events[0], id: 'new-event' });
    const workspace = mountAstroEyeWorkspace({ controller });
    await workspace.open();
    window.importQA = { workspace, recordStore, controller, incoming, before,
      choose(text, { oversized = false, delayed = false } = {}) {
        const file = new File([text], '<img src=x onerror=alert(1)>.json', { type: 'application/json' });
        if (oversized) Object.defineProperty(file, 'size', { value: 10 * 1024 * 1024 + 1 });
        if (delayed) file.text = () => new Promise((resolve) => { window.importQA.release = () => resolve(text); });
        const transfer = new DataTransfer(); transfer.items.add(file);
        const input = document.querySelector('[data-role="import-file"]');
        input.files = transfer.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      } };
  });
  const idle = () => page.waitForFunction(() => !document.querySelector('#astroeye-workspace').dataset.busy);
  const choose = async () => {
    await page.evaluate(() => window.importQA.choose(JSON.stringify(window.importQA.incoming)));
    await idle();
  };
  const click = async (action) => {
    await page.$eval(`[data-action="${action}"]`, (button) => button.click());
    await idle();
  };
  const saved = () => page.evaluate(() => window.importQA.recordStore.serializeRecords());
  const before = await saved();
  await choose();
  assert.equal(await saved(), before);
  assert.match(await page.$eval('[data-role="import-summary"]', (node) => node.textContent), /Events: 1 to add · 1 to overwrite/);
  assert.match(await page.$eval('[data-role="import-summary"]', (node) => node.textContent), /Charts: 0 to add · 0 to overwrite · 1 unchanged/);
  assert.equal(await page.$eval('[data-action="confirm-import"]', (button) => button.disabled), true);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'astroeye-import-title');
  assert.equal(await page.$eval('[data-role="import-filename"]', (node) => node.querySelectorAll('img').length), 0);
  assert.ok(await page.$eval('[data-role="import-review"]', (node) => node.scrollWidth <= node.clientWidth + 1));
  await click('cancel-import');
  assert.equal(await saved(), before);
  assert.equal(await page.evaluate(() => document.activeElement.dataset.action), 'import');
  await choose();
  const acknowledge = () => page.$eval('[data-role="import-overwrite-check"]', (checkbox) => checkbox.click());
  await acknowledge();
  assert.equal(await page.$eval('[data-action="confirm-import"]', (button) => button.disabled), false);
  await acknowledge();
  assert.equal(await page.$eval('[data-action="confirm-import"]', (button) => button.disabled), true);
  await acknowledge();
  await click('confirm-import');
  assert.equal(JSON.parse(await saved()).events.length, 2);
  assert.equal(await page.evaluate(() => window.importQA.recordStore.getEvent('original').then((event) => event.title)), 'Imported title');
  assert.equal(await page.$eval('[data-role="import-review"]', (node) => node.hidden), true);
  await choose();
  assert.equal(await page.$eval('[data-action="confirm-import"]', (button) => button.disabled), true);
  assert.match(await page.$eval('.astroeye-live-status', (node) => node.textContent), /already match/);
  assert.equal(await page.$eval('[data-role="import-overwrite-check"]', (checkbox) => checkbox.checked), false);
  await page.evaluate(() => { window.importQA.incoming.events[0].title = 'Another imported title'; });
  await choose();
  assert.equal(await page.$eval('[data-role="import-overwrite-check"]', (checkbox) => checkbox.checked), false);
  await acknowledge();
  await page.evaluate(() => window.importQA.recordStore.saveWorkspace({ id: 'newer-notes' }));
  const changed = await saved();
  await click('confirm-import');
  assert.equal(await saved(), changed);
  assert.match(await page.$eval('.astroeye-live-status', (node) => node.textContent), /changed since this review/);
  for (const [text, options, message] of [['{', {}, /JSON|property/i], ['{}', { oversized: true }, /10 MiB/]]) {
    await page.evaluate((text, options) => window.importQA.choose(text, options), text, options);
    await idle();
    assert.match(await page.$eval('.astroeye-live-status', (node) => node.textContent), message);
    assert.equal(await page.$eval('[data-role="import-review"]', (node) => node.hidden), true);
    assert.equal(await saved(), changed);
  }
  await choose();
  await page.keyboard.press('Escape');
  assert.equal(await page.$eval('[data-role="import-review"]', (node) => node.hidden), true);
  await page.evaluate(() => window.importQA.workspace.open());
  await page.evaluate(() => window.importQA.choose(JSON.stringify(window.importQA.incoming), { delayed: true }));
  await page.waitForFunction(() => Boolean(window.importQA.release));
  await page.evaluate(() => { window.importQA.workspace.close(); window.importQA.release(); });
  await idle();
  assert.equal(await page.$eval('[data-role="import-review"]', (node) => node.hidden), true);
  assert.equal(await saved(), changed);
  assert.deepEqual(errors, []);
  await page.evaluate(async () => {
    const { controller, workspace } = window.importQA;
    await workspace.open();
    await controller.saveDraft({ id: 'template-original', title: 'Original repeated-hour game', sport: 'Demo', competition: 'Cup', home: 'Home', away: 'Away',
      localDate: '2026-11-01', localTime: '01:30:15', utcStart: '2026-11-01T06:30:15Z', timeZone: 'America/New_York',
      venueName: 'Arena', latitude: 40.75, longitude: -73.99, durationMinutes: 120, houseSystem: 'equal',
      source: { kind: 'provider', provider: 'Example', sourceEventId: 'external-id' }, scheduleReviewed: true });
    document.querySelector('.astroeye-form [name="houseSystem"]').value = 'equal';
    await workspace.selectSavedEvent('template-original');
  });
  await click('time-forward');
  const beforeTemplate = await saved();
  const selectedBefore = await page.evaluate(() => window.importQA.controller.selectionSnapshot());
  await click('use-template');
  assert.equal(await saved(), beforeTemplate);
  assert.deepEqual(await page.evaluate(() => window.importQA.controller.selectionSnapshot()), selectedBefore);
  assert.equal(await page.evaluate(() => document.activeElement.name), 'title');
  const draftValues = await page.$eval('.astroeye-form', (form) => Object.fromEntries(new FormData(form)));
  assert.equal(draftValues.utcStart, '2026-11-01T06:30:15.000Z');
  assert.equal(draftValues.localTime, '01:30:15');
  assert.equal(draftValues.houseSystem, 'equal');
  assert.equal(draftValues.id, undefined);
  assert.match(await page.$eval('[data-role="draft-time-summary"]', (node) => node.textContent), /Second occurrence.*UTC-05:00.*06:30:15 UTC/);
  assert.equal(await page.$eval('.astroeye-form', (form) => form.checkValidity()), false);
  assert.ok(await page.$eval('[data-action="use-template"]', (button) => button.parentElement.scrollWidth <= button.parentElement.clientWidth + 1));
  await page.$eval('.astroeye-form', (form) => {
    form.elements.namedItem('scheduleReviewed').checked = true;
    form.elements.namedItem('title').value = 'New template game';
    form.elements.namedItem('title').dispatchEvent(new Event('input', { bubbles: true }));
  });
  assert.equal(await page.$eval('.astroeye-form [name="scheduleReviewed"]', (input) => input.checked), false);
  await page.$eval('.astroeye-form', (form) => { form.elements.namedItem('scheduleReviewed').checked = true; form.requestSubmit(); });
  await idle();
  const copiedRecords = JSON.parse(await saved());
  const newEvent = copiedRecords.events.find((event) => event.title === 'New template game');
  assert.ok(newEvent);
  assert.notEqual(newEvent.id, 'template-original');
  assert.equal(newEvent.source.kind, 'manual');
  assert.equal(newEvent.source.provider, null);
  assert.equal(newEvent.utcStart, '2026-11-01T06:30:15.000Z');
  assert.deepEqual(copiedRecords.events.find((event) => event.id === 'template-original'), JSON.parse(beforeTemplate).events.find((event) => event.id === 'template-original'));
  assert.equal(copiedRecords.events.length, JSON.parse(beforeTemplate).events.length + 1);
  const timeCheckRecords = await saved();
  const summaryState = () => page.$eval('[data-role="draft-time-summary"]', (node) => node.dataset.state);
  await page.$eval('.astroeye-form [name="utcStart"]', (select) => {
    select.value = '2026-11-01T05:30:15.000Z'; select.dispatchEvent(new Event('change', { bubbles: true }));
  });
  assert.match(await page.$eval('[data-role="draft-time-summary"]', (node) => node.textContent), /First occurrence.*UTC-04:00/);
  await page.$eval('.astroeye-form [name="localDate"]', (input) => {
    input.value = '2026-03-08'; input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  assert.equal(await summaryState(), 'pending');
  await page.$eval('.astroeye-form', (form) => {
    const time = form.elements.namedItem('localTime'); time.value = '02:30'; time.dispatchEvent(new Event('change', { bubbles: true }));
  });
  assert.equal(await summaryState(), 'nonexistent');
  await page.$eval('.astroeye-form [name="timeZone"]', (input) => {
    input.value = 'Mars/Olympus'; input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  assert.equal(await summaryState(), 'invalid');
  await page.$eval('.astroeye-form [name="localTime"]', (input) => {
    input.value = ''; input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  assert.equal(await summaryState(), 'incomplete');
  await click('new');
  assert.ok(['ready', 'ambiguous'].includes(await summaryState()));
  assert.equal(await saved(), timeCheckRecords);
  console.log('PASS: draft UTC summary follows template occurrence, manual occurrence changes, pending edits, DST gap, invalid zone, incomplete time and clear-form reset without storage writes.');
  const beforeDeletion = await saved();
  page.once('dialog', (dialog) => { void dialog.dismiss(); });
  await click('delete');
  assert.equal(await saved(), beforeDeletion);
  assert.equal(await page.$eval('[data-role="deletion-undo"]', (node) => node.hidden), true);
  page.once('dialog', (dialog) => { void dialog.accept(); });
  await click('delete');
  assert.equal(JSON.parse(await saved()).events.length, JSON.parse(beforeDeletion).events.length - 1);
  assert.equal(await page.$eval('[data-role="deletion-undo"]', (node) => node.hidden), false);
  assert.match(await page.$eval('[data-role="deletion-undo-description"]', (node) => node.textContent), /New template game/);
  await page.evaluate(async () => { window.importQA.workspace.close(); await window.importQA.workspace.open(); });
  assert.equal(await page.$eval('[data-role="deletion-undo"]', (node) => node.hidden), false);
  assert.ok(await page.$eval('[data-role="deletion-undo"]', (node) => node.scrollWidth <= node.clientWidth + 1));
  await click('undo-delete');
  assert.equal(await saved(), beforeDeletion);
  assert.equal(await page.evaluate(() => window.importQA.controller.selectionSnapshot()), null);
  assert.equal(await page.evaluate(() => document.activeElement.dataset.eventId), newEvent.id);
  assert.equal(await page.$eval('[data-role="deletion-undo"]', (node) => node.hidden), true);
  await page.evaluate((id) => window.importQA.workspace.selectSavedEvent(id), newEvent.id);
  page.once('dialog', (dialog) => { void dialog.accept(); });
  await click('delete');
  await page.evaluate((event) => window.importQA.recordStore.saveEvent({ ...event, title: 'Newer event at this ID' }), newEvent);
  const beforeConflict = await saved();
  await click('undo-delete');
  assert.equal(await saved(), beforeConflict);
  assert.match(await page.$eval('.astroeye-live-status', (node) => node.textContent), /already in use/);
  assert.equal(await page.$eval('[data-role="deletion-undo"]', (node) => node.hidden), false);
  console.log('PASS: canceled deletion makes no changes; confirmed deletion offers session undo across panel close/reopen; undo restores original records without selecting a chart; a newer event ID blocks undo without writes.');
  assert.deepEqual(errors, []);
  console.log('PASS: event template makes no writes or selection changes, preserves repeated-hour kickoff instead of preview time, copies house system, requires review, resets review after edits and saves a new manual ID without changing the original.');
  await page.evaluate(async () => { window.importQA.workspace.destroy(); await window.importQA.recordStore.close(); });
  console.log('PASS: real IndexedDB preview/no writes, add/change/identical counts, overwrite acknowledgment and reset, identical-only refusal, cancel, confirmation, stale rejection, invalid/oversized files, escaped filename, mobile width/focus, Escape and delayed-read close.');
} finally {
  await browser?.close();
  clearTimeout(deadline);
}
