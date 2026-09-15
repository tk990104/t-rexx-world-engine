import test from 'node:test';
import assert from 'node:assert/strict';
import { indexedDB } from 'fake-indexeddb';
import { createWorldRecordStore } from '../../core/worldRecordStore.js';
import { createResearchAnnotations, RESEARCH_ANNOTATIONS_ID } from './researchAnnotations.js';
import { createRecordImportReview } from './recordImportReview.js';
import { eventFromDraft } from './workspaceController.js';
import { calculateAstroEyeChart } from './calculation/chart.js';
import { matchingEventRecords } from './matchingEventExport.js';
import { captureComparison } from './chartComparison.js';
import { serializeComparisonReport } from './comparisonReport.js';
import { createSharedView, createSharedViewUrl, readSharedViewHash } from './shareView.js';
import { createAstroEyeTour } from './directorRecipe.js';

let sequence = 0;
function fixture() {
  const store = createWorldRecordStore({ indexedDB, databaseName: `qa-annotation-recovery-${++sequence}` });
  let ids = 0;
  return { store, notes: createResearchAnnotations(store, { createId: () => `astroeye-note:private-${++ids}` }),
    review: createRecordImportReview({ recordStore: store }) };
}
const selection = { event: { id: 'source', venue: { latitude: 40, longitude: -75 } },
  chart: { eventId: 'source', calculatedFor: '2026-09-14T12:15:00.000Z' } };
const secret = 'PRIVATE-ANNOTATION-SENTINEL <script>inert</script>\n🦖';

test('full backup and single-use reviewed import preserve exact orphan annotations without creating sources', async () => {
  const a = fixture(), b = fixture();
  try {
    const original = await a.notes.add(selection, secret, null);
    await a.store.saveWorkspace({ id: 'notebook-sentinel', text: 'unrelated' });
    const backup = await a.store.serializeRecords(), before = await b.store.serializeRecords();
    assert.ok(backup.includes(secret.split('\n')[0]));
    const summary = await b.review.prepareImportRecords(backup);
    assert.deepEqual(summary.workspaces, { added: 2, overwrite: 0, unchanged: 0 });
    assert.equal(await b.store.serializeRecords(), before);
    await b.review.confirmImportRecords();
    await assert.rejects(b.review.confirmImportRecords(), /review it/);
    assert.deepEqual(await b.notes.load(), original);
    assert.equal(await b.store.serializeRecords(), backup);
    assert.equal(await b.notes.sourceState(original.annotations[0]), 'source-missing');
    assert.deepEqual(await b.store.listEvents(), []);
  } finally { await a.store.close(); await b.store.close(); }
});

test('annotation import requires whole-collection overwrite acknowledgement and refuses stale approval atomically', async () => {
  const f = fixture();
  try {
    const first = await f.notes.add(selection, 'Original', null);
    const original = await f.notes.add(selection, 'Another local note', first);
    const incoming = { schemaVersion: 1, events: [], charts: [], workspaces: [
      { ...original, annotations: [{ ...original.annotations[0], note: 'Imported' }] }, { id: 'new-unrelated' }] };
    const before = await f.store.serializeRecords();
    assert.equal((await f.review.prepareImportRecords(incoming)).workspaces.overwrite, 1);
    await assert.rejects(f.review.confirmImportRecords(), /Acknowledge/);
    assert.equal(await f.store.serializeRecords(), before);
    await f.notes.edit(original.annotations[0].id, 'Newer local note', original);
    const winner = await f.store.serializeRecords();
    await assert.rejects(f.review.confirmImportRecords({ allowOverwrite: true }), /changed since this review/);
    assert.equal(await f.store.serializeRecords(), winner);
    assert.equal(await f.store.getWorkspace('new-unrelated'), null);
    await f.review.prepareImportRecords(incoming);
    await f.review.confirmImportRecords({ allowOverwrite: true });
    assert.equal((await f.notes.load()).annotations[0].note, 'Imported');
    assert.equal((await f.notes.load()).annotations.length, 1, 'Acknowledged import replaces the collection; it is not a per-note merge');
    await assert.rejects(f.notes.edit(original.annotations[0].id, 'Old editor', original), /changed in storage/);
  } finally { await f.store.close(); }
});

test('unsupported or malformed annotation payloads are preserved by backup transport but refused by the editor service', async () => {
  const a = fixture(), b = fixture();
  try {
    for (const record of [
      { id: RESEARCH_ANNOTATIONS_ID, kind: 'future-annotations', schemaVersion: 2, encrypted: 'opaque-future-data' },
      { id: RESEARCH_ANNOTATIONS_ID, kind: 'astroeye-event-annotations', schemaVersion: 1, annotations: [{}] },
    ]) {
      await a.store.saveWorkspace(record);
      const backup = await a.store.serializeRecords();
      await b.review.prepareImportRecords(backup);
      await b.review.confirmImportRecords({ allowOverwrite: true });
      const before = await b.store.serializeRecords();
      assert.equal(before, backup);
      await assert.rejects(b.notes.load(), /Unsupported/);
      await assert.rejects(b.notes.add(selection, 'Overwrite', record), /Unsupported/);
      assert.equal(await b.store.serializeRecords(), before);
    }
  } finally { await a.store.close(); await b.store.close(); }
});

test('restoration retains the original ID and frozen capture, refuses same-ID and stale collisions, and preserves other notes', async () => {
  const f = fixture();
  try {
    const original = await f.notes.add(selection, secret, null), entry = original.annotations[0];
    const empty = await f.notes.remove(entry.id, original);
    const newer = await f.notes.add(selection, 'Other note', empty);
    await assert.rejects(f.notes.restore(entry, empty), /changed in storage/);
    assert.deepEqual(await f.notes.load(), newer);
    const restored = await f.notes.restore(entry, newer);
    assert.deepEqual(restored.annotations, [...newer.annotations, entry]);
    await assert.rejects(f.notes.restore(entry, restored), /already in use/);
    assert.deepEqual(await f.notes.load(), restored);
    assert.deepEqual(await f.store.listEvents(), []);
  } finally { await f.store.close(); }
});

test('restoration enforces limits and propagates failed transactions without changing the recovery record', async () => {
  const f = fixture();
  try {
    const original = await f.notes.add(selection, secret, null), entry = original.annotations[0];
    const empty = await f.notes.remove(entry.id, original);
    const beforeEntry = structuredClone(entry);
    const failing = createResearchAnnotations({ ...f.store, saveWorkspaceIfUnchanged: async () => { throw new Error('Synthetic quota failure'); } });
    await assert.rejects(failing.restore(entry, empty), /quota failure/);
    assert.deepEqual(await f.notes.load(), empty); assert.deepEqual(entry, beforeEntry);
    await assert.rejects(f.notes.restore({ ...entry, schemaVersion: 99 }, empty), /Unsupported/);
    await assert.rejects(f.notes.restore(entry, undefined), /Unsupported/);
    const full = { ...empty, annotations: Array.from({ length: 100 }, (_, index) => ({ ...entry, id: `astroeye-note:full-${index}` })) };
    await f.store.saveWorkspace(full);
    await assert.rejects(f.notes.restore(entry, full), /100/);
    assert.deepEqual(await f.notes.load(), full);
  } finally { await f.store.close(); }
});

test('matching exports, comparison reports, decoded links and tours do not include the private annotation collection', async () => {
  const f = fixture();
  try {
    const event = eventFromDraft({ id: 'source', title: 'Public fixture', sport: 'QA', competition: 'QA', home: 'H', away: 'A',
      localDate: '2026-09-14', localTime: '12:00', timeZone: 'UTC', venueName: 'QA', latitude: 40, longitude: -75 });
    const chart = calculateAstroEyeChart(event);
    await f.store.saveEventWithChart(event, chart);
    const artifacts = async () => {
      const records = await f.store.exportRecords();
      const comparison = { ...captureComparison(event, chart), workspaces: records.workspaces };
      const shared = { ...createSharedView(event), workspaces: records.workspaces };
      const link = createSharedViewUrl('https://example.test/#v=2', shared);
      return { matching: matchingEventRecords(records, {}), report: serializeComparisonReport(comparison, comparison),
        link, decoded: readSharedViewHash(new URL(link).hash), tour: createAstroEyeTour(shared, { id: 'qa-tour' }) };
    };
    const before = await artifacts();
    const collection = await f.notes.add(selection, secret, null);
    const stored = await f.store.serializeRecords();
    const after = await artifacts();
    assert.deepEqual(after, before);
    for (const excluded of [secret, collection.id, collection.annotations[0].id]) assert.ok(!JSON.stringify(after).includes(excluded));
    assert.deepEqual(after.matching.workspaces, []);
    assert.equal(await f.store.serializeRecords(), stored);
  } finally { await f.store.close(); }
});
