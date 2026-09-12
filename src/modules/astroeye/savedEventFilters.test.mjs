import assert from 'node:assert/strict';
import test from 'node:test';
import { filterSavedEvents, normalizeSavedEventFilters, sortSavedEvents, pageSavedEvents } from './savedEventFilters.js';

const events = [
  { id: 'west', title: 'Lions at Owls', sport: 'Football', competition: 'Demo Cup', participants: { home: 'Owls', away: 'Lions' },
    scheduledLocal: { date: '2026-09-12', timeZone: 'America/Los_Angeles' }, utcStart: '2026-09-13T03:00:00Z', venue: { name: 'West Arena' } },
  { id: 'east', title: '<b>Night</b>', sport: 'Hockey', competition: 'Ice League', participants: { home: 'Bears', away: 'Stars' },
    scheduledLocal: { date: '2026-09-13', timeZone: 'Asia/Tokyo' }, utcStart: '2026-09-12T23:00:00Z', venue: { name: 'East Arena' } },
];
const ids = (filters) => filterSavedEvents(events, filters).map((event) => event.id);

test('search covers the declared fields, ignores case, and treats markup/regex as literal text', () => {
  for (const query of ['LIONS', 'owls', 'football', 'Demo Cup', 'west arena']) assert.deepEqual(ids({ query }), ['west']);
  assert.deepEqual(ids({ query: '  ice   LEAGUE ' }), ['east']);
  assert.deepEqual(ids({ query: '<b>' }), ['east']);
  assert.deepEqual(ids({ query: '.*' }), []);
});

test('date endpoints are inclusive venue-local dates, not UTC or the browser timezone', () => {
  assert.deepEqual(ids({ dateFrom: '2026-09-12', dateTo: '2026-09-12' }), ['west']);
  assert.deepEqual(ids({ dateFrom: '2026-09-13' }), ['east']);
  assert.deepEqual(ids({ dateTo: '2026-09-12' }), ['west']);
  assert.deepEqual(ids({ dateFrom: '2026-09-12', dateTo: '2026-09-13', query: 'stars' }), ['east']);
  assert.deepEqual(ids({ dateFrom: '2026-09-13', query: 'lions' }), []);
});

test('invalid dates, reversed ranges and excessive searches fail before applying', () => {
  for (const input of [{ dateFrom: '2026-02-29' }, { dateTo: '2026-04-31' }, { dateFrom: '12/09/2026' },
    { dateFrom: '2026-09-13', dateTo: '2026-09-12' }, { query: 'x'.repeat(101) }, { query: {} }, { dateFrom: null }]) {
    assert.throws(() => normalizeSavedEventFilters(input));
  }
  assert.equal(normalizeSavedEventFilters({ dateFrom: '2028-02-29' }).dateFrom, '2028-02-29');
});

test('clearing matches all records without mutating inputs or changing their order', () => {
  const before = structuredClone(events);
  assert.deepEqual(ids({}), ['west', 'east']);
  assert.deepEqual(events, before);
  assert.notEqual(filterSavedEvents(events), events);
  assert.equal(Object.isFrozen(normalizeSavedEventFilters()), true);
});

test('ordering uses actual UTC starts, keeps ID ties stable and does not mutate records', () => {
  const before = structuredClone(events);
  assert.deepEqual(sortSavedEvents(events).map((event) => event.id), ['west', 'east']);
  assert.deepEqual(sortSavedEvents(events, 'oldest').map((event) => event.id), ['east', 'west']);
  const ties = [{ id: 'b', utcStart: '2026-09-13T00:00:00Z' }, { id: 'a', utcStart: '2026-09-12T20:00:00-04:00' }];
  for (const sort of ['oldest', 'newest']) assert.deepEqual(sortSavedEvents(ties, sort).map((event) => event.id), ['a', 'b']);
  assert.deepEqual(events, before);
  assert.throws(() => normalizeSavedEventFilters({ sort: 'random' }));
});

test('pages are bounded to 25 rows and clamp correctly after a collection shrinks', () => {
  const rows = Array.from({ length: 61 }, (_, id) => ({ id }));
  const first = pageSavedEvents(rows);
  assert.equal(first.items.length, 25);
  assert.equal(first.pageCount, 3);
  assert.equal(first.from, 1); assert.equal(first.to, 25);
  const last = pageSavedEvents(rows, 200);
  assert.equal(last.page, 2); assert.equal(last.items.length, 11);
  assert.equal(last.from, 51); assert.equal(last.to, 61);
  assert.equal(pageSavedEvents(rows.slice(0, 5), 2).page, 0);
  assert.equal(pageSavedEvents(rows, -1).page, 0);
  assert.equal(pageSavedEvents(rows, NaN).page, 0);
  assert.deepEqual(pageSavedEvents([]), { page: 0, pageCount: 1, total: 0, from: 0, to: 0, items: [] });
  assert.equal(rows.length, 61);
});
