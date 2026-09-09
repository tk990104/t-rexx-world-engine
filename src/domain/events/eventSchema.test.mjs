import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizeEvent,
  parseEventJson,
  resolveZonedLocalTime,
  serializeEvent,
} from './eventSchema.js';

function fixture(overrides = {}) {
  return {
    id: 'nfl-2026-week-1-example',
    title: 'Away Team at Home Team',
    sport: 'American Football',
    competition: 'NFL',
    participants: { home: 'Home Team', away: 'Away Team' },
    scheduledLocal: { date: '2026-09-09', time: '20:15', timeZone: 'America/New_York' },
    venue: {
      name: 'Example Stadium',
      latitude: 40.7505,
      longitude: -73.9934,
      coordinateSource: 'user-confirmed',
    },
    source: { kind: 'manual' },
    ...overrides,
  };
}

test('New York event time preserves local input and crosses the UTC date boundary', () => {
  const event = normalizeEvent(fixture());
  assert.equal(event.scheduledLocal.time, '20:15:00');
  assert.equal(event.utcStart, '2026-09-10T00:15:00.000Z');
});

test('spring-forward gap cannot produce an event', () => {
  const result = resolveZonedLocalTime({
    localDate: '2026-03-08', localTime: '02:30', timeZone: 'America/New_York',
  });
  assert.equal(result.status, 'nonexistent');
  assert.throws(
    () => normalizeEvent(fixture({ scheduledLocal: {
      date: '2026-03-08', time: '02:30', timeZone: 'America/New_York',
    } })),
    /does not exist/,
  );
});

test('fall-back fold exposes both instants and refuses to guess', () => {
  const scheduledLocal = {
    date: '2026-11-01', time: '01:30', timeZone: 'America/New_York',
  };
  const result = resolveZonedLocalTime({
    localDate: scheduledLocal.date,
    localTime: scheduledLocal.time,
    timeZone: scheduledLocal.timeZone,
  });
  assert.equal(result.status, 'ambiguous');
  assert.deepEqual(result.candidates, [
    '2026-11-01T05:30:00.000Z',
    '2026-11-01T06:30:00.000Z',
  ]);
  assert.throws(() => normalizeEvent(fixture({ scheduledLocal })), /ambiguous/);
});

test('an ambiguous time becomes canonical only with a matching UTC choice', () => {
  const scheduledLocal = {
    date: '2026-11-01', time: '01:30', timeZone: 'America/New_York',
  };
  const event = normalizeEvent(fixture({
    scheduledLocal,
    utcStart: '2026-11-01T06:30:00.000Z',
  }));
  assert.equal(event.utcStart, '2026-11-01T06:30:00.000Z');
  assert.throws(() => normalizeEvent(fixture({
    scheduledLocal,
    utcStart: '2026-11-01T07:30:00.000Z',
  })), /does not match/);
});

test('southern-hemisphere daylight time is resolved by IANA rules', () => {
  const result = resolveZonedLocalTime({
    localDate: '2026-12-25', localTime: '19:00', timeZone: 'Australia/Sydney',
  });
  assert.deepEqual(result.candidates, ['2026-12-25T08:00:00.000Z']);
});

test('leap day and a non-DST zone remain exact', () => {
  const result = resolveZonedLocalTime({
    localDate: '2028-02-29', localTime: '23:59:59', timeZone: 'America/Phoenix',
  });
  assert.equal(result.status, 'exact');
  assert.deepEqual(result.candidates, ['2028-03-01T06:59:59.000Z']);
});

test('unknown zones, impossible dates, and invalid coordinates fail closed', () => {
  assert.throws(() => resolveZonedLocalTime({
    localDate: '2026-09-09', localTime: '20:00', timeZone: 'Eastern-ish',
  }), /Unknown IANA/);
  assert.throws(() => resolveZonedLocalTime({
    localDate: '2026-02-30', localTime: '20:00', timeZone: 'UTC',
  }), /calendar range/);
  assert.throws(() => normalizeEvent(fixture({
    venue: { name: 'Nowhere', latitude: 91, longitude: 0 },
  })), /venue.latitude/);
});

test('normalized event JSON round-trips byte-stably', () => {
  const first = serializeEvent(fixture());
  const second = serializeEvent(parseEventJson(first));
  assert.equal(second, first);
});
