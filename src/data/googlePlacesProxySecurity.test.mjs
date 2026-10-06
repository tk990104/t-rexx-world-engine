import assert from 'node:assert/strict';
import test from 'node:test';
import { googlePlacesContextProxy } from '../../vite.config.js';
import { parseGooglePlacesQuery } from '../../server/googlePlacesRequest.js';
import { VOICE_PROVIDER_MAX_BYTES } from '../../server/voiceProviderResponse.js';

const PRIVATE = 'synthetic-key-and-provider-error';
const NEARBY = '/api/google/nearby-places';
const TEXT = '/api/google/text-search';
const invalidQueries = ['/', '/?lat=&lon=0', '/?lat=0', '/?lat=91&lon=0', '/?lat=0&lon=-181',
  '/?lat=NaN&lon=0', '/?lat=Infinity&lon=0', '/?lat=0x10&lon=0', '/?lat=0&lon=0&lat=1',
  '/?lat=0&lon=0&unknown=1', '/?lat=0&lon=0&radiusM=', '/?lat=0&lon=0&radiusM=0',
  '/?lat=0&lon=0&radiusM=-1', '/?lat=0&lon=0&radiusM=Infinity', '/?lat=0&lon=0&radiusM=1&radiusM=2'];

test('Places parser requires finite decimal coordinates and unique known parameters', () => {
  for (const query of invalidQueries) assert.equal(parseGooglePlacesQuery(query), null, query);
  assert.equal(parseGooglePlacesQuery('/?lat=%20&lon=0'), null);
  assert.equal(parseGooglePlacesQuery('/?lat=0&lon=0&q=unused'), null);
  assert.equal(parseGooglePlacesQuery('/?lat=1e999&lon=0'), null);
});
test('Places parser accepts zero/boundaries and preserves positive radius clamping/defaults', () => {
  assert.deepEqual(parseGooglePlacesQuery('/?lat=0&lon=0'), { latitude: 0, longitude: 0, textQuery: undefined, radiusM: 250 });
  assert.equal(parseGooglePlacesQuery('/?lat=90&lon=-180&radiusM=1').radiusM, 25);
  assert.equal(parseGooglePlacesQuery('/?lat=-90&lon=180&radiusM=90000').radiusM, 5000);
  assert.equal(parseGooglePlacesQuery('/?lat=3e1&lon=-97.5&q=Place', true).radiusM, 4000);
  assert.equal(parseGooglePlacesQuery('/?lat=0&lon=0&q=Place&radiusM=90000', true).radiusM, 50000);
});
test('text search requires one nonblank query up to 500 code units', () => {
  for (const q of ['', '%20', 'a'.repeat(501), 'a&q=b']) assert.equal(parseGooglePlacesQuery(`/?lat=0&lon=0&q=${q}`, true), null);
  assert.equal(parseGooglePlacesQuery('/?lat=0&lon=0', true), null);
  assert.equal(parseGooglePlacesQuery(`/?lat=0&lon=0&q=${'a'.repeat(500)}`, true).textQuery.length, 500);
});

function routes(hook, options = {}) {
  const handlers = new Map();
  googlePlacesContextProxy({ env: { GOOGLE_MAPS_API_KEY: PRIVATE }, rateLimiter: () => null,
    fetchImpl: () => assert.fail('Unexpected provider call'), ...options,
  })[hook]({ middlewares: { use: (path, handler) => handlers.set(path, handler) } });
  return handlers;
}
async function invoke(handlers, path, { url = `/?lat=30&lon=-97${path === TEXT ? '&q=Place' : ''}`, method = 'GET', headers = {}, socket = {} } = {}) {
  const req = { url, method, headers: { host: '127.0.0.1:5173', 'sec-fetch-site': 'same-origin', ...headers }, socket: { remoteAddress: '127.0.0.1', localPort: 5173, ...socket } };
  const res = { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, end(body) { this.body = String(body); } };
  await handlers.get(path)(req, res);
  assert.equal(res.body.includes(PRIVATE), false);
  res.data = JSON.parse(res.body);
  if (res.statusCode !== 200) { assert.equal(res.headers['cache-control'], 'no-store'); assert.deepEqual(res.data.places, []); }
  return res;
}
const sample = i => ({ id: String(i), displayName: { text: `Place ${i}` }, formattedAddress: 'Long address', shortFormattedAddress: 'Short address',
  location: { latitude: 30, longitude: -97 }, primaryType: 'park', types: Array(12).fill('park'),
  viewport: { low: { latitude: 29, longitude: -98 }, high: { latitude: 31, longitude: -96 } }, private: PRIVATE });

for (const hook of ['configureServer', 'configurePreviewServer']) for (const path of [NEARBY, TEXT]) {
  test(`${hook} ${path}: reject foreign/absent context before keys or rate limiting`, async () => {
    const handlers = routes(hook, { env: { get GOOGLE_MAPS_API_KEY() { assert.fail('Must not read key'); } }, rateLimiter: () => assert.fail('Must not throttle') });
    for (const headers of [{ origin: 'https://foreign.example' }, { 'sec-fetch-site': undefined }, { 'sec-fetch-site': 'same-site' }, { host: 'rebound.example:5173' }, { 'sec-fetch-mode': 'navigate' }]) {
      const denied = await invoke(handlers, path, { headers }); assert.equal(denied.statusCode, 403); assert.equal(denied.headers.connection, 'close');
    }
    assert.equal((await invoke(handlers, path, { socket: { remoteAddress: '192.168.1.1' } })).statusCode, 403);
  });
  test(`${hook} ${path}: invalid inputs and methods precede key/provider work`, async () => {
    const handlers = routes(hook, { env: { get GOOGLE_MAPS_API_KEY() { assert.fail('Must not read key'); } } });
    for (let url of invalidQueries) {
      if (path === TEXT) url += `${url.includes('?') ? '&' : '?'}q=Place`;
      assert.equal((await invoke(handlers, path, { url })).statusCode, 400);
    }
    if (path === TEXT) assert.equal((await invoke(handlers, path, { url: '/?lat=0&lon=0&q=' + 'a'.repeat(501) })).statusCode, 400);
    assert.equal((await invoke(handlers, path, { method: 'POST' })).statusCode, 405);
  });
  test(`${hook} ${path}: missing key and throttle remain safe/no-store`, async () => {
    assert.equal((await invoke(routes(hook, { env: {} }), path)).statusCode, 503);
    const limited = await invoke(routes(hook, { rateLimiter: () => () => false }), path);
    assert.equal(limited.statusCode, 429); assert.equal(limited.headers['retry-after'], '5');
  });
  test(`${hook} ${path}: successful query preserves provider fields and bounded normalized output`, async () => {
    const handlers = routes(hook, { fetchImpl: async (url, options) => {
      assert.equal(url, `https://places.googleapis.com/v1/places:${path === TEXT ? 'searchText' : 'searchNearby'}`);
      assert.equal(options.redirect, 'error'); assert.ok(options.signal instanceof AbortSignal);
      assert.equal(options.headers['X-Goog-Api-Key'], PRIVATE);
      assert.ok(options.headers['X-Goog-FieldMask'].includes('places.location'));
      const body = JSON.parse(options.body);
      const circle = (body.locationBias || body.locationRestriction).circle;
      assert.deepEqual(circle.center, { latitude: 30, longitude: -97 });
      assert.equal(circle.radius, path === TEXT ? 4000 : 250);
      assert.equal(body.maxResultCount, path === TEXT ? 5 : 20);
      if (path === TEXT) assert.equal(body.textQuery, 'Place');
      return Response.json({ places: Array.from({ length: 25 }, (_, i) => sample(i)), private: PRIVATE });
    } });
    const res = await invoke(handlers, path);
    assert.equal(res.statusCode, 200); assert.equal(res.data.error, null);
    assert.equal(res.headers['cache-control'], 'private, max-age=300');
    assert.equal(res.data.places.length, path === TEXT ? 5 : 20);
    assert.equal(res.data.places[0].distanceM, 0); assert.equal(res.data.places[0].types.length, 8);
    assert.equal(res.data.places[0].address, path === TEXT ? 'Long address' : 'Short address');
    if (path === TEXT) assert.deepEqual(res.data.places[0].viewport, sample(0).viewport);
    assert.deepEqual((await invoke(routes(hook, { fetchImpl: async () => Response.json({}) }), path)).data, { places: [], error: null });
  });
  test(`${hook} ${path}: upstream errors are canceled unread and safe status is retained`, async () => {
    let cancels = 0;
    for (const status of [400, 403, 429, 500, 302]) {
      const handlers = routes(hook, { fetchImpl: async () => ({ ok: false, status,
        body: { cancel() { cancels++; return Promise.resolve(); }, getReader() { assert.fail('Must not read error'); } } }) });
      const res = await invoke(handlers, path);
      assert.equal(res.statusCode, status === 302 ? 502 : status);
      assert.equal(res.data.error, 'Google Places request failed');
    }
    assert.equal(cancels, 5);
  });
  test(`${hook} ${path}: invalid JSON, malformed payloads and exceptions return fixed failures`, async () => {
    for (const fetchImpl of [() => { throw Error(PRIVATE); }, () => new Response('{bad'), () => Response.json(null),
      () => Response.json([]), () => Response.json({ places: {} }), () => Response.json({ error: { message: PRIVATE } }),
      () => Response.json({ places: [null] }),
    ]) assert.equal((await invoke(routes(hook, { fetchImpl }), path)).statusCode, 502);
  });
  test(`${hook} ${path}: overflow and stalled fetch/body fail safely; valid retry works`, async () => {
    let attempt = 0, cancels = 0;
    const handlers = routes(hook, { upstreamTimeoutMs: 20, fetchImpl: async () => {
      attempt++;
      if (attempt === 1) return new Response(new ReadableStream({ start(c) { c.enqueue(new Uint8Array(VOICE_PROVIDER_MAX_BYTES + 1)); }, cancel() { cancels++; } }), { headers: { 'content-length': '1' } });
      if (attempt === 2) return new Promise(() => {});
      if (attempt === 3) return new Response(new ReadableStream({ cancel() { cancels++; } }));
      return Response.json({ places: [sample(0)] });
    } });
    for (let i = 0; i < 3; i++) assert.equal((await invoke(handlers, path)).statusCode, 502);
    assert.equal(cancels, 2); assert.equal((await invoke(handlers, path)).statusCode, 200);
  });
}
