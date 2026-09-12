import assert from 'node:assert/strict';
import test from 'node:test';
import { indexedDB } from 'fake-indexeddb';
import { createWorldRecordStore } from '../../core/worldRecordStore.js';
import { calculateAstroEyeChart } from './calculation/chart.js';
import { createRecordImportReview } from './recordImportReview.js';

const EVENT = { id: 'existing', title: 'Original event', sport: 'Demo', competition: 'Cup',
  participants: { home: 'Home', away: 'Away' },
  scheduledLocal: { date: '2026-09-09', time: '20:15', timeZone: 'America/New_York' },
  venue: { name: 'Arena', latitude: 40.75, longitude: -73.99, coordinateSource: 'user-confirmed' }, source: { kind: 'manual' } };
let sequence = 0;
async function harness() {
  const recordStore = createWorldRecordStore({ indexedDB, databaseName: `import-review-${++sequence}` });
  const event = await recordStore.saveEvent(EVENT);
  const chart = await recordStore.saveChart(calculateAstroEyeChart(event));
  await recordStore.saveWorkspace({ id: 'existing-notes', title: 'Original notes' });
  const notifications = [];
  const review = createRecordImportReview({ recordStore, onImported: (result) => notifications.push(result) });
  const incoming = { schemaVersion: 1, events: [{ ...event, title: 'Imported title' }, { ...event, id: 'new-event' }],
    charts: [chart, { ...chart, chartId: 'new-chart', eventId: 'new-event' }],
    workspaces: [{ id: 'existing-notes', title: 'Imported notes' }, { id: 'new-notes' }] };
  return { recordStore, review, incoming, notifications };
}

test('review counts add/overwrite by ID for all stores and does not write until a single confirmation', async () => {
  const { recordStore, review, incoming, notifications } = await harness();
  try {
    const before = await recordStore.serializeRecords();
    const summary = await review.prepareImportRecords(incoming);
    assert.deepEqual(summary, { events: { added: 1, overwrite: 1, unchanged: 0 }, charts: { added: 1, overwrite: 0, unchanged: 1 }, workspaces: { added: 1, overwrite: 1, unchanged: 0 } });
    assert.equal(await recordStore.serializeRecords(), before);
    assert.equal(notifications.length, 0);
    incoming.events[0].title = 'Mutated after review';
    summary.events.overwrite = 0;
    await assert.rejects(review.confirmImportRecords(), /Acknowledge/);
    await assert.rejects(review.confirmImportRecords({ allowOverwrite: 'true' }), /Acknowledge/);
    assert.equal(await recordStore.serializeRecords(), before);
    const confirmation = review.confirmImportRecords({ allowOverwrite: true });
    await assert.rejects(review.confirmImportRecords(), /review it/);
    assert.deepEqual(await confirmation, { mode: 'merge', events: 2, charts: 1, workspaces: 2 });
    assert.equal((await recordStore.getEvent('existing')).title, 'Imported title');
    assert.equal(notifications.length, 1);
  } finally { await recordStore.close(); }
});

test('cancel discards the review without any record mutation', async () => {
  const { recordStore, review, incoming } = await harness();
  try {
    const before = await recordStore.serializeRecords();
    await review.prepareImportRecords(JSON.stringify(incoming));
    review.cancelImportReview();
    await assert.rejects(review.confirmImportRecords(), /review it/);
    assert.equal(await recordStore.serializeRecords(), before);
  } finally { await recordStore.close(); }
});

for (const change of ['event', 'chart', 'workspace']) {
  test(`a concurrent ${change} edit invalidates approval and imports no partial records`, async () => {
    const { recordStore, review, incoming, notifications } = await harness();
    try {
      await review.prepareImportRecords(incoming);
      if (change === 'event') await recordStore.saveEvent({ ...EVENT, title: 'Newer local title' });
      if (change === 'chart') await recordStore.saveChart({ ...incoming.charts[0], note: 'Newer chart' });
      if (change === 'workspace') await recordStore.saveWorkspace({ id: 'existing-notes', title: 'Newer local notes' });
      const before = await recordStore.serializeRecords();
      await assert.rejects(review.confirmImportRecords({ allowOverwrite: true }), /changed since this review/);
      assert.equal(await recordStore.serializeRecords(), before);
      assert.equal(notifications.length, 0);
      await assert.rejects(review.confirmImportRecords(), /review it/);
    } finally { await recordStore.close(); }
  });
}

test('invalid JSON, schema, duplicate IDs, orphan charts and empty files clear prior approval without writes', async () => {
  const { recordStore, review, incoming } = await harness();
  try {
    const before = await recordStore.serializeRecords();
    const invalid = ['{', { ...incoming, schemaVersion: 99 }, { ...incoming, events: [incoming.events[0], incoming.events[0]] },
      { ...incoming, charts: [{ ...incoming.charts[0], eventId: 'unknown' }] }, { schemaVersion: 1, events: [], charts: [], workspaces: [] }];
    for (const input of invalid) {
      await review.prepareImportRecords(incoming);
      await assert.rejects(review.prepareImportRecords(input));
      await assert.rejects(review.confirmImportRecords(), /review it/);
      assert.equal(await recordStore.serializeRecords(), before);
    }
  } finally { await recordStore.close(); }
});

test('merge preview accepts charts linked to already-saved events and preserves unrelated records', async () => {
  const { recordStore, review, incoming } = await harness();
  try {
    const summary = await review.prepareImportRecords({ schemaVersion: 1, events: [], charts: [{ ...incoming.charts[0], chartId: 'additional-chart' }], workspaces: [] });
    assert.deepEqual(summary.charts, { added: 1, overwrite: 0, unchanged: 0 });
    await review.confirmImportRecords();
    assert.equal((await recordStore.listEvents()).length, 1);
    assert.equal((await recordStore.listWorkspaces()).length, 1);
  } finally { await recordStore.close(); }
});

test('cancel and newer reviews discard delayed responses', async () => {
  const releases = [];
  const review = createRecordImportReview({ recordStore: { previewImportRecords: () => new Promise((resolve) => releases.push(resolve)) } });
  const first = review.prepareImportRecords('first');
  review.cancelImportReview();
  releases[0]({ summary: { name: 'first' } });
  assert.equal(await first, null);
  const second = review.prepareImportRecords('second');
  const third = review.prepareImportRecords('third');
  releases[2]({ summary: { name: 'third' } });
  assert.deepEqual(await third, { name: 'third' });
  releases[1]({ summary: { name: 'second' } });
  assert.equal(await second, null);
});

test('identical data with reordered nested object keys is skipped and cannot trigger a write or notification', async () => {
  const { recordStore, review, notifications } = await harness();
  try {
    const before = await recordStore.serializeRecords();
    const reorder = (value) => Array.isArray(value) ? value.map(reorder) : value && typeof value === 'object'
      ? Object.fromEntries(Object.entries(value).reverse().map(([key, entry]) => [key, reorder(entry)])) : value;
    const summary = await review.prepareImportRecords(reorder(JSON.parse(before)));
    for (const counts of Object.values(summary)) assert.deepEqual(counts, { added: 0, overwrite: 0, unchanged: 1 });
    await assert.rejects(review.confirmImportRecords({ allowOverwrite: true }), /already match/);
    assert.equal(await recordStore.serializeRecords(), before);
    assert.equal(notifications.length, 0);
  } finally { await recordStore.close(); }
});

test('array order and nested value changes are real overwrites, and approval is not reused for a new review', async () => {
  const { recordStore, review } = await harness();
  try {
    await recordStore.saveWorkspace({ id: 'ordered', items: ['first', 'second'], nested: { value: 1 } });
    const incoming = { schemaVersion: 1, events: [], charts: [], workspaces: [{ id: 'ordered', items: ['second', 'first'], nested: { value: 1 } }] };
    const first = await review.prepareImportRecords(incoming);
    assert.deepEqual(first.workspaces, { added: 0, overwrite: 1, unchanged: 0 });
    await review.confirmImportRecords({ allowOverwrite: true });
    incoming.workspaces[0].nested.value = 2;
    const second = await review.prepareImportRecords(incoming);
    assert.equal(second.workspaces.overwrite, 1);
    await assert.rejects(review.confirmImportRecords(), /Acknowledge/);
    assert.equal((await recordStore.getWorkspace('ordered')).nested.value, 1);
  } finally { await recordStore.close(); }
});
