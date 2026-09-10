import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeSportsSchedule, normalizeSportsVenue, parseVenueCoordinates, scheduleLocalTime } from './sportsSchedule.js';
import { createSportsScheduleHandler, sportsScheduleProxy } from '../../../server/sportsScheduleProxy.js';
import { eventFromDraft } from './workspaceController.js';

// Synthetic provider-shaped test records, not actual game schedule assertions.
const RAW = { idEvent: '10001', idLeague: '4391', strHomeTeam: 'Home', strAwayTeam: 'Away',
  dateEvent: '2026-09-11', strTime: '00:35:00', strTimeLocal: '17:35:00', dateEventLocal: '2026-09-10',
  strStatus: 'NS', strPostponed: 'no', idVenue: '25720', strVenue: 'Fixture ground', strCity: 'Melbourne' };
const fetched = '2026-09-10T01:00:00.000Z';
const payload = { events: [RAW] };

test('dev and preview hooks install middleware without returning an executable post-hook', () => {
  const plugin = sportsScheduleProxy();
  const mounted = [];
  const server = { middlewares: { use: (handler) => { mounted.push(handler); return () => { throw new Error('connect app is not a post-hook'); }; } } };
  assert.equal(plugin.configureServer(server), undefined);
  assert.equal(plugin.configurePreviewServer(server), undefined);
  assert.equal(mounted[0], mounted[1]);
});

test('NFL schedules preserve source identity and UTC across venue date boundaries', () => {
  const { events } = normalizeSportsSchedule(payload, fetched);
  const game = events[0];
  assert.equal(game.utcStart, '2026-09-11T00:35:00.000Z');
  assert.equal(game.title, 'Away at Home');
  assert.deepEqual(game.source, { kind: 'provider', provider: 'thesportsdb', sourceEventId: '10001', retrievedAt: fetched });
  assert.deepEqual(scheduleLocalTime(game.utcStart, 'Australia/Melbourne'), {
    localDate: '2026-09-11', localTime: '10:35:00', utcStart: game.utcStart,
  });
  assert.equal(scheduleLocalTime(game.utcStart, 'America/Los_Angeles').localDate, '2026-09-10');
});

test('both DST fold instants round-trip with explicit UTC choices', () => {
  for (const utc of ['2026-11-01T05:30:00.000Z', '2026-11-01T06:30:00.000Z']) {
    const local = scheduleLocalTime(utc, 'America/New_York');
    const event = eventFromDraft({ title: 'Fold', sport: 'Football', competition: 'NFL', home: 'Home', away: 'Away',
      ...local, timeZone: 'America/New_York', venueName: 'Fixture', latitude: 40, longitude: -74 }, () => 'fold');
    assert.equal(event.utcStart, utc);
  }
});

test('uncertain, postponed, cancelled, missing and placeholder midnight starts remain unavailable', () => {
  for (const override of [{ strTime: null }, { strTime: '00:00:00' }, { strTime: '25:00' }, { dateEvent: '2026-02-30' },
    { strStatus: 'Time to be defined' }, { strStatus: 'Match Cancelled' }, { strPostponed: 'yes' }]) {
    assert.equal(normalizeSportsSchedule({ events: [{ ...RAW, ...override }] }, fetched).events[0].utcStart, null);
  }
});

test('malformed responses fail, incomplete records are counted, and duplicate IDs are omitted', () => {
  assert.throws(() => normalizeSportsSchedule({ error: 'key rejected' }, fetched), /unexpected/);
  assert.equal(normalizeSportsSchedule({ events: null }, fetched).events.length, 0);
  const result = normalizeSportsSchedule({ events: [RAW, RAW, { ...RAW, idLeague: '4328' }, null] }, fetched);
  assert.equal(result.events.length, 1);
  assert.equal(result.skipped, 3);
});

test('venue parsing accepts decimal or DMS and preserves missing coordinates', () => {
  assert.deepEqual(parseVenueCoordinates('37°49′12″S 144°59′0″E'), { latitude: -37.82, longitude: 144 + 59 / 60 });
  assert.deepEqual(parseVenueCoordinates('0, 0'), { latitude: 0, longitude: 0 });
  for (const value of ['', null, 'https://example.com/map', '91,180', '37°99′12″S 144°59′0″E']) assert.equal(parseVenueCoordinates(value), null);
  assert.equal(normalizeSportsVenue({ venues: null }, '25720'), null);
  assert.equal(normalizeSportsVenue({ venues: [{ idVenue: 'other' }] }, '25720'), null);
});

test('provider drafts require explicit review and retain provenance', () => {
  const game = normalizeSportsSchedule(payload, fetched).events[0];
  const draft = { ...game, ...scheduleLocalTime(game.utcStart, 'Australia/Melbourne'), timeZone: 'Australia/Melbourne', latitude: -37.82, longitude: 144.9833 };
  assert.throws(() => eventFromDraft(draft, () => 'review'), /Check the schedule/);
  const event = eventFromDraft({ ...draft, scheduleReviewed: true }, () => 'review');
  assert.deepEqual(event.source, game.source);
});

async function request(handler, url = '/api/astroeye/sports', method = 'GET') {
  const headers = {};
  let result;
  await handler({ url, method }, { setHeader: (key, value) => { headers[key] = value; },
    set statusCode(value) { headers.status = value; }, end: (value) => { result = JSON.parse(value); } }, () => { result = 'next'; });
  return { ...headers, result };
}

test('schedule proxy deduplicates concurrent reads and expires cached results', async () => {
  let count = 0, time = Date.parse(fetched), release;
  const gate = new Promise((resolve) => { release = resolve; });
  const handler = createSportsScheduleHandler({ now: () => time, fetchImpl: async () => {
    count += 1; await gate; return { ok: true, json: async () => payload };
  }});
  const first = request(handler), second = request(handler);
  release();
  const responses = await Promise.all([first, second]);
  assert.equal(count, 1);
  assert.ok(responses.every((response) => response.status === 200));
  assert.equal((await request(handler)).result.cached, true);
  time += 16 * 60000;
  await request(handler);
  assert.equal(count, 2);
});

test('proxy rejects arbitrary paths, methods and malformed queries without upstream calls', async () => {
  const handler = createSportsScheduleHandler({ fetchImpl: () => { throw new Error('must not fetch'); } });
  for (const query of ['date=2026-02-30', 'venue=../secret', 'url=https://example.com', 'date=2026-09-10&venue=1', 'date=2026-09-10&date=2026-09-11']) {
    assert.equal((await request(handler, `/api/astroeye/sports?${query}`)).status, 400);
  }
  assert.equal((await request(handler, '/api/astroeye/sports', 'POST')).status, 405);
  assert.equal((await request(handler, '/unrelated')).result, 'next');
});

test('provider failures hide keys and honor rate-limit cooldown without serving stale schedules', async () => {
  let calls = 0, time = Date.parse(fetched);
  const handler = createSportsScheduleHandler({ now: () => time, apiKey: () => 'test-private-key', fetchImpl: async () => {
    calls += 1;
    return { ok: false, status: 429 };
  }});
  assert.equal((await request(handler)).status, 503);
  assert.equal((await request(handler)).status, 429);
  assert.equal(calls, 1);
  time += 61000;
  assert.ok(!JSON.stringify(await request(handler)).includes('test-private-key'));
  assert.equal(calls, 2);
});
