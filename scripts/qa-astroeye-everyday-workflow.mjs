import assert from 'node:assert/strict';

// Composed user actions in the manual/share harness's owned synthetic profile.
export async function checkEverydayWorkflow(page, click, mark) {
  const records = () => page.evaluate(() => qa.store.serializeRecords());
  const panelClick = async (kind, action) => {
    await page.$eval(`[data-${kind}="${action}"]`, node => node.click());
    await page.waitForFunction(kind => !document.querySelector(`[data-${kind}="reload"]`).disabled, {}, kind);
  };
  const edit = async (role, text) => page.$eval(`[data-role="${role}"] textarea`, (node, text) => {
    node.value = text; node.dispatchEvent(new Event('input', { bubbles: true }));
  }, text);
  const compare = action => page.$eval(`[data-comparison="${action}"]`, node => node.click());
  const initialBackup = await records(), initial = JSON.parse(initialBackup), eventId = initial.events[0].id;
  mark('everyday-comparison-and-capture');
  await click(page, 'compare-charts'); await compare('pin');
  const pinned = await page.$eval('[data-comparison="pinned"]', node => node.textContent);
  await click(page, 'time-forward');
  assert.equal(await records(), initialBackup);
  await click(page, 'event-notes');
  await page.waitForFunction(() => !document.querySelector('[data-annotation="reload"]').disabled);
  await panelClick('annotation', 'new');
  await edit('event-notes', 'PRIVATE-EVERYDAY-EVENT-NOTE <img src=x>');
  await click(page, 'time-forward'); // Draft capture must remain at the earlier preview.
  const beforeNoteNavigation = await page.evaluate(() => qa.navigation);
  await panelClick('annotation', 'save');
  assert.equal(await page.evaluate(() => qa.navigation), beforeNoteNavigation);
  const note = await page.evaluate(async () => (await qa.notes.load()).annotations[0]);
  assert.equal(note.eventId, eventId);
  assert.equal(note.chartTimeUtc, '2026-11-01T06:45:00.000Z');
  assert.equal(note.note, 'PRIVATE-EVERYDAY-EVENT-NOTE <img src=x>');
  assert.equal(await page.$('[data-role="event-notes"] img'), null);
  await click(page, 'research-notes');
  await page.waitForFunction(() => !document.querySelector('[data-role="research-notebook"] textarea').disabled);
  await edit('research-notebook', 'PRIVATE-EVERYDAY-NOTEBOOK');
  await panelClick('note', 'save');
  assert.equal(await page.$eval('[data-comparison="pinned"]', node => node.textContent), pinned);
  assert.match(await page.$eval('[data-comparison="current"]', node => node.textContent), /07:00:00.000Z/);
  const beforeReport = await records();
  await compare('export');
  const report = await page.evaluate(() => qa.comparisonDownloads.at(-1));
  assert.match(report, /06:30:00.000Z/); assert.match(report, /07:00:00.000Z/);
  assert.doesNotMatch(report, /PRIVATE-EVERYDAY/);
  assert.equal(await records(), beforeReport);
  mark('everyday-backup-delete-undo');
  await click(page, 'export');
  const backup = await page.evaluate(() => qa.recordDownloads.at(-1).text);
  assert.equal(backup, beforeReport);
  assert.match(backup, /PRIVATE-EVERYDAY-EVENT-NOTE/); assert.match(backup, /PRIVATE-EVERYDAY-NOTEBOOK/);
  await click(page, 'export-matching');
  const matching = await page.evaluate(() => qa.recordDownloads.at(-1));
  assert.equal(matching.filename, 't-rexx-matching-events.json');
  assert.deepEqual(JSON.parse(matching.text).workspaces, []);
  assert.doesNotMatch(matching.text, /PRIVATE-EVERYDAY/);
  const remove = async () => {
    page.once('dialog', dialog => void dialog.accept());
    await click(page, 'delete');
    const deleted = JSON.parse(await records());
    assert.deepEqual(deleted.events, []); assert.deepEqual(deleted.charts, []);
    assert.deepEqual(deleted.workspaces, JSON.parse(backup).workspaces);
  };
  const navigation = await page.evaluate(() => qa.navigation);
  await remove();
  assert.equal(await page.evaluate(() => qa.markerClears), 1);
  await click(page, 'undo-delete');
  assert.equal(await records(), backup, 'Undo restores exact backup without changing research');
  assert.equal(await page.evaluate(() => qa.navigation), navigation);
  // Choose the restored event through its rendered Saved events button.
  const select = async () => {
    await page.$eval('button[data-event-id]', node => node.click());
    await page.waitForFunction(() => !document.querySelector('#astroeye-workspace').dataset.busy);
    assert.equal(await page.evaluate(() => qa.controller.selectionSnapshot().event.id), eventId);
  };
  await select(); await remove();
  assert.equal(await page.evaluate(() => qa.markerClears), 2);
  mark('everyday-reviewed-backup-import');
  const beforeImport = await records();
  const chooseBackup = async () => {
    await page.evaluate(text => {
      const transfer = new DataTransfer();
      transfer.items.add(new File([text], 'synthetic-private-backup.json', { type: 'application/json' }));
      const input = document.querySelector('[data-role="import-file"]');
      input.files = transfer.files; input.dispatchEvent(new Event('change', { bubbles: true }));
    }, backup);
    await page.waitForFunction(() => !document.querySelector('#astroeye-workspace').dataset.busy);
    assert.equal(await page.$eval('[data-role="import-review"]', node => node.hidden), false);
    assert.equal(await records(), beforeImport, 'Review alone cannot write the backup');
    assert.match(await page.$eval('[data-role="import-summary"]', node => node.textContent), /Events: 1 to add/);
  };
  await chooseBackup(); await click(page, 'cancel-import');
  assert.equal(await records(), beforeImport);
  await chooseBackup(); await click(page, 'confirm-import');
  assert.equal(await records(), backup, 'Confirmed import restores exact event/chart/private records');
  await select();
  await click(page, 'event-notes'); await panelClick('annotation', 'reload');
  await page.select('[data-annotation="list"]', note.id);
  assert.equal(await page.$eval('[data-role="event-notes"] textarea', node => node.value), note.note);
  assert.match(await page.$eval('[data-annotation="capture"]', node => node.textContent), /06:45:00.000Z/);
  return { eventId, noteId: note.id, backup, evidence: {
    manualForm: true, frozenComparison: true, frozenNoteCapture: true, notebookSaved: true,
    exportAllContainsPrivateResearch: true, matchingAndComparisonExcludePrivateResearch: true,
    eventDeleteUndoPreservesExactBackup: true, importReviewAndCancelDoNotWrite: true,
    confirmedImportRestoresExactBackup: true,
    downloadPayloadsCaptured: true, nativeDownloadVerified: false,
  } };
}
