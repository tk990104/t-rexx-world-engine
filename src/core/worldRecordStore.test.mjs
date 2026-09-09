import assert from 'node:assert/strict';
import test from 'node:test';

import { indexedDB } from 'fake-indexeddb';

import { calculateAstroEyeChart } from '../modules/astroeye/calculation/chart.js';
import { createWorldRecordStore } from './worldRecordStore.js';

const EVENT = {
  id: 'event-1',
  title: 'Away Team at Home Team',
  sport: 'American Football',
  competition: 'NFL',
  participants: { home: 'Home Team', away: 'Away Team' },
  scheduledLocal: { date: '2026-09-09', time: '20:15', timeZone: 'America/New_York' },
  venue: {
    name: 'Example Stadium', latitude: 40.7505, longitude: -73.9934, coordinateSource: 'user-confirmed',
  },
  source: { kind: 'manual' },
};

let sequence = 0;
function store() {
  sequence += 1;
  return createWorldRecordStore({ indexedDB, databaseName: `t-rexx-test-${sequence}` });
}

test('IndexedDB world records round-trip canonical events and linked charts', async () => {
  const records = store();
  const event = await records.saveEvent(EVENT);
  const chart = await records.saveChart(calculateAstroEyeChart(event));
  assert.deepEqual(await records.getEvent(event.id), event);
  assert.deepEqual(await records.getChart(chart.chartId), chart);
  assert.deepEqual((await records.listCharts({ eventId: event.id })).map(({ chartId }) => chartId), [chart.chartId]);
  await records.close();
});

test('record export is ordered and byte-stable', async () => {
  const records = store();
  await records.saveEvent({ ...EVENT, id: 'z-event' });
  await records.saveEvent({ ...EVENT, id: 'a-event' });
  await records.saveWorkspace({ id: 'workspace-1', title: 'AstroEye research' });
  const { serializeRecords } = records;
  const first = await serializeRecords();
  const second = await records.serializeRecords();
  assert.equal(first, second);
  assert.deepEqual(JSON.parse(first).events.map(({ id }) => id), ['a-event', 'z-event']);
  await records.close();
});

test('deleting an event atomically removes its derived charts', async () => {
  const records = store();
  const event = await records.saveEvent(EVENT);
  const chart = await records.saveChart(calculateAstroEyeChart(event));
  assert.equal(await records.deleteEvent(event.id), true);
  assert.equal(await records.getEvent(event.id), null);
  assert.equal(await records.getChart(chart.chartId), null);
  assert.equal(await records.deleteEvent(event.id), false);
  await records.close();
});

test('replace import is atomic and rejects charts without an event', async () => {
  const records = store();
  await records.saveEvent(EVENT);
  const invalid = {
    schemaVersion: 1,
    events: [],
    charts: [{ ...calculateAstroEyeChart(EVENT), eventId: 'missing-event' }],
    workspaces: [],
  };
  await assert.rejects(records.importRecords(invalid, { mode: 'replace' }), /unknown event/);
  assert.deepEqual((await records.listEvents()).map(({ id }) => id), ['event-1']);

  const replacement = {
    schemaVersion: 1,
    events: [{ ...EVENT, id: 'replacement' }],
    charts: [],
    workspaces: [],
  };
  assert.deepEqual(await records.importRecords(replacement, { mode: 'replace' }), {
    mode: 'replace', events: 1, charts: 0, workspaces: 0,
  });
  assert.deepEqual((await records.listEvents()).map(({ id }) => id), ['replacement']);
  await records.close();
});

test('records validate before writes and storage unavailability fails explicitly', async () => {
  assert.throws(() => createWorldRecordStore({ indexedDB: null }), /IndexedDB is unavailable/);
  const records = store();
  await assert.rejects(records.saveEvent({ ...EVENT, scheduledLocal: { ...EVENT.scheduledLocal, timeZone: 'Mars/Olympus' } }), /Unknown IANA/);
  await assert.rejects(records.saveChart(calculateAstroEyeChart(EVENT)), /unknown event/);
  assert.deepEqual(await records.exportRecords(), { schemaVersion: 1, events: [], charts: [], workspaces: [] });
  await records.close();
});
