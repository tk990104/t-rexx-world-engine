import assert from 'node:assert/strict';
import test from 'node:test';
import { indexedDB } from 'fake-indexeddb';
import { createWorldRecordStore } from '../../core/worldRecordStore.js';
import { createResearchNotebook, RESEARCH_NOTEBOOK_ID, MAX_RESEARCH_NOTE_LENGTH } from './researchNotebook.js';

let sequence = 0;
function fixture() {
  const records = createWorldRecordStore({ indexedDB, databaseName: `qa-notebook-${++sequence}` });
  return { records, notebook: createResearchNotebook(records) };
}

test('notebook is absent until saved and persists exact plain text in full backups', async () => {
  const { records, notebook } = fixture();
  try {
    const before = await records.serializeRecords();
    assert.equal(await notebook.load(), null);
    assert.equal(await records.serializeRecords(), before);
    const text = 'Research <script>not executable</script>\nαβ 🌍';
    const saved = await notebook.save(text, null);
    assert.equal(saved.text, text);
    assert.deepEqual(await createResearchNotebook(records).load(), saved);
    const exported = await records.exportRecords();
    assert.deepEqual(exported.events, []); assert.deepEqual(exported.charts, []);
    assert.deepEqual(exported.workspaces, [saved]);
    const other = fixture();
    try { await other.records.importRecords(exported); assert.deepEqual(await other.notebook.load(), saved); }
    finally { await other.records.close(); }
  } finally { await records.close(); }
});

test('stale saves and concurrent first saves refuse overwrites atomically', async () => {
  const { records, notebook } = fixture();
  try {
    const first = await notebook.save('First', null);
    const second = await notebook.save('Second', first);
    await assert.rejects(notebook.save('Stale draft', first), /changed in storage/);
    assert.deepEqual(await notebook.load(), second);
    const fresh = fixture();
    try {
      const results = await Promise.allSettled([fresh.notebook.save('A', null), fresh.notebook.save('B', null)]);
      assert.equal(results.filter(({ status }) => status === 'fulfilled').length, 1);
      assert.equal(results.filter(({ status }) => status === 'rejected').length, 1);
    } finally { await fresh.records.close(); }
  } finally { await records.close(); }
});

test('invalid or future notebook formats and oversized edits are never overwritten', async () => {
  const { records, notebook } = fixture();
  try {
    for (const text of [null, 12, 'x'.repeat(MAX_RESEARCH_NOTE_LENGTH + 1)]) await assert.rejects(notebook.save(text, null), /10,000/);
    const foreign = { id: RESEARCH_NOTEBOOK_ID, schemaVersion: 2, kind: 'future', text: 'Preserve me' };
    await records.saveWorkspace(foreign);
    await assert.rejects(notebook.load(), /unsupported format/);
    await assert.rejects(notebook.save('Overwrite', foreign), /unsupported format/);
    assert.deepEqual(await records.getWorkspace(RESEARCH_NOTEBOOK_ID), foreign);
  } finally { await records.close(); }
});

test('length boundary, blank saves and additional workspace metadata survive correctly', async () => {
  const { records, notebook } = fixture();
  try {
    const first = await notebook.save('x'.repeat(MAX_RESEARCH_NOTE_LENGTH), null);
    const withMetadata = { ...first, extra: { provenance: 'test' } };
    await records.saveWorkspace(withMetadata);
    const saved = await notebook.save('', await notebook.load());
    assert.equal(saved.text, ''); assert.deepEqual(saved.extra, withMetadata.extra);
    await assert.rejects(records.saveWorkspaceIfUnchanged(saved, undefined), /Expected workspace/);
    await assert.rejects(records.saveWorkspaceIfUnchanged(saved, { ...saved, id: 'other' }), /Expected workspace/);
  } finally { await records.close(); }
});
