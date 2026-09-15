import test from 'node:test';
import assert from 'node:assert/strict';
import { indexedDB } from 'fake-indexeddb';
import { createWorldRecordStore } from '../../core/worldRecordStore.js';
import { createResearchAnnotations, validateResearchAnnotations, RESEARCH_ANNOTATIONS_ID } from './researchAnnotations.js';
import { eventFromDraft } from './workspaceController.js';
import { createResearchNotebook } from './researchNotebook.js';

let sequence = 0;
function fixture() {
  const store = createWorldRecordStore({ indexedDB, databaseName: `qa-research-annotations-${++sequence}` });
  let ids = 0;
  const service = createResearchAnnotations(store, { createId: () => `astroeye-note:${++ids}` });
  const selection = { event: { id: 'source', venue: { latitude: 40, longitude: -75 } },
    chart: { eventId: 'source', calculatedFor: '2026-09-14T12:15:00.000Z' } };
  return { store, service, selection };
}
test('captures exact plain text, frozen time and coordinates; reads never create a collection', async () => {
  const f = fixture();
  try {
    const empty = await f.store.serializeRecords();
    assert.equal(await f.service.load(), null); assert.equal(await f.store.serializeRecords(), empty);
    const note = '  <script>inert text</script>\n🦖 research  ';
    const saved = await f.service.add(f.selection, note, null);
    f.selection.chart.calculatedFor = '2026-09-14T13:00:00.000Z'; f.selection.event.venue.latitude = 0;
    const edited = await f.service.edit(saved.annotations[0].id, 'Edited note', saved);
    assert.deepEqual({ ...edited.annotations[0], note }, saved.annotations[0]);
    const loaded = await f.service.load(); loaded.annotations[0].note = 'caller mutation';
    assert.deepEqual(await f.service.load(), edited);
    assert.equal(edited.annotations[0].chartTimeUtc, '2026-09-14T12:15:00.000Z');
  } finally { await f.store.close(); }
});
test('atomic stale edits/deletes and concurrent initial saves cannot overwrite a winner', async () => {
  const f = fixture();
  try {
    const outcomes = await Promise.allSettled([f.service.add(f.selection, 'A', null), f.service.add(f.selection, 'B', null)]);
    assert.equal(outcomes.filter((x) => x.status === 'fulfilled').length, 1);
    const old = await f.service.load(), id = old.annotations[0].id;
    const winner = await f.service.edit(id, 'Winner', old);
    await assert.rejects(f.service.edit(id, 'Stale', old), /changed in storage/);
    await assert.rejects(f.service.remove(id, old), /changed in storage/);
    assert.deepEqual(await f.service.load(), winner);
    const cleared = await f.service.remove(id, winner);
    assert.deepEqual(cleared.annotations, []);
    await assert.rejects(f.service.add(f.selection, 'Stale create', null), /changed in storage/);
  } finally { await f.store.close(); }
});
test('source deletion and undo preserve frozen notes and separate notebook bytes', async () => {
  const f = fixture();
  try {
    const event = eventFromDraft({ id: 'source', title: 'QA', sport: 'QA', competition: 'QA', home: 'H', away: 'A',
      localDate: '2026-09-14', localTime: '12:00', timeZone: 'UTC', venueName: 'QA', latitude: 40, longitude: -75 });
    await f.store.saveEvent(event);
    const notebook = await createResearchNotebook(f.store).save('Existing notebook', null);
    const saved = await f.service.add(f.selection, 'Research', null), entry = saved.annotations[0];
    assert.equal(await f.service.sourceState(entry), 'source-present');
    await f.store.deleteEvent('source');
    assert.equal(await f.service.sourceState(entry), 'source-missing');
    assert.deepEqual(await f.service.load(), saved);
    await f.store.restoreDeletedEvent({ event, charts: [] });
    assert.equal(await f.service.sourceState(entry), 'source-present');
    assert.deepEqual(await f.service.load(), saved);
    await f.service.remove(entry.id, saved);
    assert.deepEqual(await createResearchNotebook(f.store).load(), notebook);
    assert.deepEqual(await f.store.getEvent('source'), event);
  } finally { await f.store.close(); }
});
test('malformed captures, oversized notes and unsupported saved versions are refused without writes', async () => {
  const f = fixture();
  try {
    const before = await f.store.serializeRecords();
    for (const note of ['', '  ', 'x'.repeat(2001), 'bad\0text', null]) await assert.rejects(f.service.add(f.selection, note, null));
    for (const change of [ { chart: { ...f.selection.chart, eventId: 'other' } },
      { chart: { ...f.selection.chart, calculatedFor: '2026-02-30T12:00:00.000Z' } },
      { event: { id: 'source', venue: { latitude: '40', longitude: -75 } } } ]) {
      await assert.rejects(f.service.add({ ...f.selection, ...change }, 'Note', null));
    }
    assert.equal(await f.store.serializeRecords(), before);
    const future = { id: RESEARCH_ANNOTATIONS_ID, kind: 'future', schemaVersion: 2, annotations: [] };
    await f.store.saveWorkspace(future);
    await assert.rejects(f.service.load(), /Unsupported/);
    await assert.rejects(f.service.add(f.selection, 'overwrite', future), /Unsupported/);
    assert.deepEqual(await f.store.getWorkspace(RESEARCH_ANNOTATIONS_ID), future);
  } finally { await f.store.close(); }
});
test('collection cap, duplicate IDs, unknown fields and explicit baselines are enforced', async () => {
  const f = fixture();
  try {
    const one = await f.service.add(f.selection, 'x'.repeat(2000), null);
    const full = { ...one, annotations: Array.from({ length: 100 }, (_, i) => ({ ...one.annotations[0], id: `astroeye-note:cap-${i}` })) };
    await f.store.saveWorkspace(full);
    await assert.rejects(f.service.add(f.selection, 'overflow', full), /100/);
    assert.throws(() => validateResearchAnnotations({ ...one, extra: true }), /Unsupported/);
    assert.throws(() => validateResearchAnnotations({ ...one, annotations: [one.annotations[0], one.annotations[0]] }), /Duplicate/);
    assert.throws(() => validateResearchAnnotations({ ...one, annotations: new Array(1) }), /Unsupported/);
    assert.throws(() => validateResearchAnnotations({ ...one, annotations: [{ ...one.annotations[0], eventId: ' source ' }] }), /Unsupported/);
    await assert.rejects(f.service.add(f.selection, 'no baseline', undefined), /Unsupported/);
    assert.deepEqual(await f.service.load(), full);
  } finally { await f.store.close(); }
});
test('write failure propagates without mutating caller records or a saved collection', async () => {
  const f = fixture();
  try {
    const saved = await f.service.add(f.selection, 'Original', null), copy = structuredClone(saved);
    const failing = createResearchAnnotations({ ...f.store, saveWorkspaceIfUnchanged: async () => { throw new Error('quota failure'); } });
    await assert.rejects(failing.edit(saved.annotations[0].id, 'Unsaved draft', saved), /quota failure/);
    assert.deepEqual(saved, copy); assert.deepEqual(await f.service.load(), saved);
  } finally { await f.store.close(); }
});
