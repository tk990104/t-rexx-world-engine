import assert from 'node:assert/strict';
import test from 'node:test';
import { indexedDB } from 'fake-indexeddb';
import { createWorldRecordStore, MAX_IMPORT_FILE_BYTES } from './worldRecordStore.js';
import { createRecordImportReview, MAX_IMPORT_FILE_BYTES as UI_LIMIT } from '../modules/astroeye/recordImportReview.js';

const backup = JSON.stringify({ schemaVersion: 1, events: [], charts: [], workspaces: [{ id: 'imported' }] });
let sequence = 0;
const createStore = () => createWorldRecordStore({ indexedDB, databaseName: `import-limit-${++sequence}` });

test('UI and record API share the 10 MiB limit', () => {
  assert.equal(UI_LIMIT, MAX_IMPORT_FILE_BYTES);
  assert.equal(UI_LIMIT, 10 * 1024 * 1024);
});

test('oversized text is rejected before parsing or opening storage', async () => {
  let opens = 0;
  const records = createWorldRecordStore({ indexedDB: { open() { opens++; throw Error('Must not open'); } } });
  const invalid = '{'.repeat(MAX_IMPORT_FILE_BYTES + 1);
  await assert.rejects(records.previewImportRecords(invalid), /10 MiB/);
  for (const mode of ['merge', 'replace']) await assert.rejects(records.importRecords(invalid, { mode }), /10 MiB/);
  assert.equal(opens, 0);
});

test('exact-limit JSON is accepted; one extra byte cannot replace saved records', async () => {
  const records = createStore();
  try {
    await records.saveWorkspace({ id: 'private', note: 'Keep me' });
    const text = backup + ' '.repeat(MAX_IMPORT_FILE_BYTES - Buffer.byteLength(backup));
    const before = await records.serializeRecords();
    assert.equal((await records.previewImportRecords(text)).summary.workspaces.added, 1);
    for (const mode of ['merge', 'replace']) await assert.rejects(records.importRecords(text + ' ', { mode }), /10 MiB/);
    assert.equal(await records.serializeRecords(), before);
    await records.importRecords(text);
    assert.deepEqual((await records.listWorkspaces()).map(({ id }) => id), ['imported', 'private']);
  } finally { await records.close(); }
});

for (const character of ['é', '中', '🌍', '\ud800', '\udc00']) {
  test(`UTF-8 byte boundary handles ${JSON.stringify(character)} without trusting character count`, async () => {
    const records = createStore();
    try {
      const shell = '{"schemaVersion":1,"events":[],"charts":[],"workspaces":[{"id":"unicode","note":""}]}';
      const count = Math.floor((MAX_IMPORT_FILE_BYTES - Buffer.byteLength(shell)) / Buffer.byteLength(character));
      const raw = shell.replace('"note":""', `"note":"${character.repeat(count)}"`);
      const text = raw + ' '.repeat(MAX_IMPORT_FILE_BYTES - Buffer.byteLength(raw));
      assert.equal(Buffer.byteLength(text), MAX_IMPORT_FILE_BYTES);
      assert.equal((await records.previewImportRecords(text)).summary.workspaces.added, 1);
      await assert.rejects(records.previewImportRecords(text + ' '), /10 MiB/);
      assert.deepEqual(await records.listWorkspaces(), []);
    } finally { await records.close(); }
  });
}

test('oversized replacement review clears prior approval and permits a fresh valid review', async () => {
  const records = createStore();
  let notifications = 0;
  const review = createRecordImportReview({ recordStore: records, onImported: () => notifications++ });
  try {
    await records.saveWorkspace({ id: 'private', note: 'Keep me' });
    const before = await records.serializeRecords();
    await review.prepareImportRecords(backup);
    await assert.rejects(review.prepareImportRecords(' '.repeat(MAX_IMPORT_FILE_BYTES + 1)), /10 MiB/);
    await assert.rejects(review.confirmImportRecords(), /review it/);
    assert.equal(await records.serializeRecords(), before);
    assert.equal(notifications, 0);
    await review.prepareImportRecords(backup);
    await review.confirmImportRecords();
    assert.equal(notifications, 1);
  } finally { await records.close(); }
});
