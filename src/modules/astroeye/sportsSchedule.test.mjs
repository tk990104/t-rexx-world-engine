import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeSportsSchedule, normalizeSportsVenue, parseVenueCoordinates, scheduleLocalTime } from './sportsSchedule.js';
import { createSportsScheduleHandler, sportsScheduleProxy, MAX_SPORTS_RESPONSE_BYTES } from '../../../server/sportsScheduleProxy.js';
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
    count += 1; await gate; return new Response(JSON.stringify(payload));
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

function streamingReply(chunks, headers = {}) {
  let reads = 0, cancelled = false;
  const body = new ReadableStream({
    pull(controller) {
      if (reads === chunks.length) controller.close();
      else controller.enqueue(chunks[reads++]);
    },
    cancel() { cancelled = true; },
  }, { highWaterMark: 0 });
  return { response: new Response(body, { headers }), reads: () => reads, cancelled: () => cancelled };
}

test('provider byte limit rejects declared oversize before reading and keeps errors key-free', async () => {
  const reply = streamingReply([new TextEncoder().encode(JSON.stringify(payload))],
    { 'Content-Length': String(MAX_SPORTS_RESPONSE_BYTES + 1) });
  const handler = createSportsScheduleHandler({ apiKey: () => 'private-test-key', fetchImpl: async () => reply.response });
  const result = await request(handler);
  assert.equal(result.status, 503);
  assert.match(result.result.error, /enter the event manually/);
  assert.doesNotMatch(JSON.stringify(result), /private-test-key|Provider response too large/);
  assert.equal(reply.reads(), 0);
  assert.equal(reply.cancelled(), true);
});

test('chunked or understated responses stop at the byte cap and are not cached', async () => {
  for (const headers of [{}, { 'Content-Length': '1' }]) {
    const reply = streamingReply([new Uint8Array(MAX_SPORTS_RESPONSE_BYTES), new Uint8Array(1), new Uint8Array(1)], headers);
    let calls = 0;
    const handler = createSportsScheduleHandler({ fetchImpl: async () => ++calls === 1 ? reply.response : new Response(JSON.stringify(payload)) });
    assert.equal((await request(handler)).status, 503);
    assert.equal(reply.reads(), 2);
    assert.equal(reply.cancelled(), true);
    assert.equal((await request(handler)).status, 200);
    assert.equal((await request(handler)).result.cached, true);
    assert.equal(calls, 2);
  }
});

test('exact byte boundary succeeds and UTF-8 is decoded across chunk boundaries', async () => {
  const json = JSON.stringify({ events: [{ ...RAW, strHomeTeam: 'Hôme 🦖' }] });
  const bytes = new TextEncoder().encode(json);
  const padded = new Uint8Array(MAX_SPORTS_RESPONSE_BYTES).fill(32);
  padded.set(bytes);
  const split = bytes.indexOf(0xc3) + 1; // Split inside the UTF-8 encoding of ô.
  const reply = streamingReply([padded.slice(0, split), padded.slice(split)]);
  const handler = createSportsScheduleHandler({ fetchImpl: async () => reply.response });
  const result = await request(handler);
  assert.equal(result.status, 200);
  assert.equal(result.result.events[0].home, 'Hôme 🦖');
  assert.equal(reply.cancelled(), false);
});

test('venue replies use the same limit and count UTF-8 bytes rather than characters', async () => {
  const json = JSON.stringify({ venues: [], unused: '🦖'.repeat(MAX_SPORTS_RESPONSE_BYTES / 4) });
  assert.ok(json.length < MAX_SPORTS_RESPONSE_BYTES);
  assert.ok(new TextEncoder().encode(json).byteLength > MAX_SPORTS_RESPONSE_BYTES);
  const handler = createSportsScheduleHandler({ fetchImpl: async () => new Response(json) });
  assert.equal((await request(handler, '/api/astroeye/sports?venue=25720')).status, 503);
});

test('malformed JSON and failed streams remain private and retryable', async () => {
  for (const response of [new Response('{invalid private-test-key'), new Response(new ReadableStream({
    start(controller) { controller.error(new Error('private-test-key')); },
  }))]) {
    let calls = 0;
    const handler = createSportsScheduleHandler({ fetchImpl: async () => ++calls === 1 ? response : new Response(JSON.stringify(payload)) });
    const result = await request(handler);
    assert.equal(result.status, 503);
    assert.doesNotMatch(JSON.stringify(result), /private-test-key/);
    assert.equal((await request(handler)).status, 200);
    assert.equal(calls, 2);
  }
});

test('concurrent oversized reads share one failure without awaiting cancellation acknowledgement', { timeout: 2000 }, async () => {
  let calls = 0, cancelled = false, release;
  const gate = new Promise(resolve => { release = resolve; });
  const response = new Response(new ReadableStream({
    pull(controller) { controller.enqueue(new Uint8Array(MAX_SPORTS_RESPONSE_BYTES + 1)); },
    cancel() { cancelled = true; return new Promise(() => {}); },
  }, { highWaterMark: 0 }));
  const handler = createSportsScheduleHandler({ fetchImpl: async () => {
    calls++;
    if (calls === 1) { await gate; return response; }
    return new Response(JSON.stringify(payload));
  } });
  const first = request(handler), second = request(handler);
  release();
  const results = await Promise.all([first, second]);
  assert.deepEqual(results.map(result => result.status), [503, 503]);
  assert.equal(calls, 1);
  assert.equal(cancelled, true);
  assert.equal((await request(handler)).status, 200);
  assert.equal(calls, 2);
});
