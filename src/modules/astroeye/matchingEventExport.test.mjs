import assert from 'node:assert/strict';
import test from 'node:test';
import { matchingEventRecords } from './matchingEventExport.js';
import { normalizeSavedEventFilters } from './savedEventFilters.js';

test('matching export includes every match beyond page and marker limits and only linked charts', () => {
  const events = Array.from({ length: 121 }, (_, i) => ({ id: `event-${i}`, title: i < 120 ? 'Keep' : 'Private',
    venue: { name: 'Arena' }, utcStart: new Date(Date.UTC(2026, 0, 1) + i * 86400000).toISOString(), scheduledLocal: { date: '2026-01-01' } }));
  const records = { schemaVersion: 1, events, charts: events.map(({ id }) => ({ chartId: `chart-${id}`, eventId: id })),
    workspaces: [{ id: 'private-notebook', secret: 'not exported' }], camera: 'not exported' };
  const before = JSON.stringify(records);
  const result = matchingEventRecords(records, normalizeSavedEventFilters({ query: 'Keep', sort: 'oldest' }));
  assert.equal(result.events.length, 120);
  assert.equal(result.charts.length, 120);
  assert.equal(result.events[0].id, 'event-0');
  assert.ok(result.charts.every((chart) => chart.eventId !== 'event-120'));
  assert.deepEqual(result.workspaces, []);
  assert.deepEqual(Object.keys(result), ['schemaVersion', 'events', 'charts', 'workspaces']);
  assert.equal(JSON.stringify(records), before);
});

test('empty exports fail clearly and venue-local inclusive date filters apply', () => {
  const records = { schemaVersion: 1, events: [{ id: 'one', title: 'Keep', utcStart: '2026-09-10T00:15:00Z',
    venue: { name: 'Arena' }, scheduledLocal: { date: '2026-09-09' } }], charts: [], workspaces: [] };
  assert.equal(matchingEventRecords(records, normalizeSavedEventFilters({ dateFrom: '2026-09-09', dateTo: '2026-09-09' })).events.length, 1);
  assert.throws(() => matchingEventRecords(records, normalizeSavedEventFilters({ dateFrom: '2026-09-10' })), /Nothing was exported/);
});
