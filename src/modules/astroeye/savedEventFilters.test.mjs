import assert from 'node:assert/strict';
import test from 'node:test';
import { filterSavedEvents, normalizeSavedEventFilters } from './savedEventFilters.js';

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
