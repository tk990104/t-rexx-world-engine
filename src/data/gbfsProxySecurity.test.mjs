import assert from 'node:assert/strict';
import test from 'node:test';
import { gbfsProxy } from '../../vite.config.js';
import { fetchGbfsText, GbfsResponseError, GBFS_MAX_BODY_BYTES, GBFS_PROXY_TIMEOUT_MS } from '../../server/gbfsResponse.js';

const TARGET = 'https://gbfs.lyft.com/gbfs/2.3/bkn/en/station_information.json';
const PRIVATE = 'synthetic-private-path-and-error';
const request = (fetchImpl, timeoutMs = 1000) => fetchGbfsText(TARGET, { fetchImpl, timeoutMs });
const code = expected => error => error instanceof GbfsResponseError && error.code === expected;

test('GBFS uses its own 5 MiB/12 second budget, GET, JSON accept and redirect rejection', async () => {
  assert.equal(GBFS_MAX_BODY_BYTES, 5242880); assert.equal(GBFS_PROXY_TIMEOUT_MS, 12000);
  const result = await request(async (url, options) => {
    assert.equal(url, TARGET); assert.equal(options.method, 'GET');
    assert.equal(options.redirect, 'error'); assert.equal(options.headers.Accept, 'application/json');
    assert.ok(options.signal instanceof AbortSignal); return new Response('{}');
  });
  assert.equal(result.text, '{}');
});
test('exact byte cap accepts split UTF-8 and strips BOM like fetch text', async () => {
  const bytes = Buffer.from('\ufeff🌍' + ' '.repeat(GBFS_MAX_BODY_BYTES - 7));
  const response = new Response(new ReadableStream({ start(c) {
    c.enqueue(bytes.subarray(0, 5)); c.enqueue(bytes.subarray(5)); c.close();
  } }));
  const result = await request(async () => response);
  assert.equal(result.text, '🌍' + ' '.repeat(GBFS_MAX_BODY_BYTES - 7));
  assert.equal(response.body.locked, false);
});
test('declared oversized body cancels and releases without reading or awaiting cancellation', async () => {
  let canceled = 0, released = 0;
  await assert.rejects(request(async () => ({ ok: true,
    headers: new Headers({ 'content-length': String(GBFS_MAX_BODY_BYTES + 1) }),
    body: { getReader: () => ({ read() { assert.fail('Must not read'); },
      cancel() { canceled++; return new Promise(() => {}); }, releaseLock() { released++; } }) },
  })), code('size'));
  assert.equal(canceled, 1); assert.equal(released, 1);
});
test('missing/false length cannot bypass streaming cap and cleanup', async () => {
  for (const headers of [{}, { 'content-length': '1' }]) {
    let canceled = 0;
    const response = new Response(new ReadableStream({ start(c) {
      c.enqueue(new Uint8Array(GBFS_MAX_BODY_BYTES)); c.enqueue(new Uint8Array(1));
    }, cancel() { canceled++; } }), { headers });
    await assert.rejects(request(async () => response), code('size'));
    assert.equal(canceled, 1); assert.equal(response.body.locked, false);
  }
});
test('multibyte text below the character cap still rejects byte overflow', async () => {
  const value = '中'.repeat(Math.ceil(GBFS_MAX_BODY_BYTES / 3));
  assert.ok(value.length < GBFS_MAX_BODY_BYTES);
  await assert.rejects(request(async () => new Response(value)), code('size'));
});
test('stalled fetch times out and a late abort-insensitive response is canceled', async () => {
  let release, signal, canceled = 0;
  const pending = request((_url, options) => { signal = options.signal; return new Promise(resolve => { release = resolve; }); }, 20);
  await assert.rejects(pending, code('timeout')); assert.equal(signal.aborted, true);
  release({ body: { cancel() { canceled++; return Promise.reject(Error(PRIVATE)); } } });
  await new Promise(resolve => setImmediate(resolve)); assert.equal(canceled, 1);
});
test('deadline covers a stalled body; cleanup cannot hold the route open', async () => {
  let canceled = 0, released = 0, signal;
  await assert.rejects(request(async (_url, options) => { signal = options.signal; return {
    ok: true, headers: new Headers(), body: { getReader: () => ({
      read: () => new Promise(() => {}), cancel() { canceled++; return new Promise(() => {}); },
      releaseLock() { released++; },
    }) },
  }; }, 20), code('timeout'));
  assert.equal(signal.aborted, true); assert.equal(canceled, 1); assert.equal(released, 1);
});
test('non-success body is canceled unread even if cancellation rejects', async () => {
  let canceled = 0;
  const result = await request(async () => ({ ok: false, status: 429, body: {
    getReader() { assert.fail('Must not read'); }, cancel() { canceled++; return Promise.reject(Error(PRIVATE)); },
  } }));
  assert.equal(result.text, null); assert.equal(canceled, 1);
});
test('stream failure releases ownership and a later request succeeds; empty responses remain supported', async () => {
  const response = new Response(new ReadableStream({ start(c) { c.error(Error(PRIVATE)); } }));
  await assert.rejects(request(async () => response)); assert.equal(response.body.locked, false);
  assert.equal((await request(async () => new Response('{}'))).text, '{}');
  assert.equal((await request(async () => new Response(null, { status: 204 }))).text, '');
});

function handler(hook, options = {}) {
  let route;
  gbfsProxy({ fetchImpl: () => assert.fail('Unexpected upstream call'), ...options })[hook]({
    middlewares: { use(path, fn) { assert.equal(path, '/api/gbfs'); route = fn; } },
  });
  return route;
}
async function invoke(route, { url = '/' + encodeURIComponent(TARGET), method = 'GET' } = {}) {
  const res = { headers: {}, writeHead(status, headers) {
    this.status = status; this.headers = Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
  }, end(body) { this.body = body; } };
  await route({ method, url }, res);
  assert.equal(res.body.includes(PRIVATE), false);
  if (res.status >= 300) assert.equal(res.headers['cache-control'], 'no-store');
  return res;
}
for (const hook of ['configureServer', 'configurePreviewServer']) {
  test(`${hook}: rejects invalid methods/encoding/hosts/paths/credentials/ports before fetch`, async () => {
    const route = handler(hook);
    assert.equal((await invoke(route, { method: 'POST' })).status, 405);
    for (const url of ['/', '/%zz', '/not-a-url']) assert.equal((await invoke(route, { url })).status, 400);
    for (const target of [TARGET.replace('https:', 'http:'), TARGET.replace('https://', 'https://user:pass@'),
      TARGET.replace('.com/', '.com:8443/'), TARGET.replace('station_information', 'system_information'),
      TARGET.replace('station_information.json', '../other.json')]) {
      assert.equal((await invoke(route, { url: '/' + encodeURIComponent(target) })).status, 400);
    }
    for (const target of [TARGET.replace('gbfs.lyft.com', 'evil.example'),
      TARGET.replace('gbfs.lyft.com', 'publicbikesystem.net.evil.example'), TARGET.replace('gbfs.lyft.com', '127.0.0.1')]) {
      assert.equal((await invoke(route, { url: '/' + encodeURIComponent(target) })).status, 403);
    }
  });
  test(`${hook}: preserves information/status feed bodies, allowlists and success cache policy`, async () => {
    const body = JSON.stringify({ data: { stations: [{ name: 'Station 🌍', station_id: '1' }] } });
    const route = handler(hook, { fetchImpl: async (_url, options) => {
      assert.equal(options.redirect, 'error'); return new Response(body, { headers: { 'content-type': 'text/html' } });
    } });
    for (const target of [TARGET, TARGET.replace('gbfs.lyft.com', 'sample.publicbikesystem.net'), TARGET.replace('.com/', '.com:443/')]) {
      const res = await invoke(route, { url: '/' + encodeURIComponent(target) });
      assert.equal(res.status, 200); assert.equal(res.body, body);
      assert.equal(res.headers['cache-control'], 'public, max-age=300');
      assert.equal(res.headers['content-type'], 'application/json; charset=utf-8');
      assert.equal(res.headers['x-gbfs-upstream'], new URL(target).hostname); assert.equal(res.headers['x-gbfs-cache'], 'MISS');
    }
    assert.equal((await invoke(route, { url: '/' + encodeURIComponent(TARGET.replace('station_information', 'station_status')) })).headers['cache-control'], 'no-store');
  });
  test(`${hook}: upstream error/redirect bodies never reach browser or success cache`, async () => {
    let canceled = 0;
    for (const status of [302, 400, 403, 429, 500]) {
      const res = await invoke(handler(hook, { fetchImpl: async () => ({ ok: false, status,
        body: { cancel() { canceled++; return Promise.resolve(); }, getReader() { assert.fail('Unread'); } },
      }) }));
      assert.equal(res.status, status === 302 ? 502 : status);
      assert.deepEqual(JSON.parse(res.body), { error: 'GBFS upstream request failed' });
    }
    assert.equal(canceled, 5);
  });
  test(`${hook}: redirect/transport/stream failures use fixed errors`, async () => {
    for (const fetchImpl of [() => { throw Error(PRIVATE); }, () => new Response(new ReadableStream({ start(c) { c.error(Error(PRIVATE)); } }))]) {
      const res = await invoke(handler(hook, { fetchImpl }));
      assert.equal(res.status, 502); assert.deepEqual(JSON.parse(res.body), { error: 'GBFS proxy error' });
    }
  });
  test(`${hook}: overflow/stalls fail safely and an independent retry succeeds`, async () => {
    let attempt = 0, canceled = 0;
    const route = handler(hook, { upstreamTimeoutMs: 20, fetchImpl: async () => {
      attempt++;
      if (attempt === 1) return new Response(new ReadableStream({ start(c) { c.enqueue(new Uint8Array(GBFS_MAX_BODY_BYTES + 1)); }, cancel() { canceled++; } }), { headers: { 'content-length': '1' } });
      if (attempt === 2) return new Promise(() => {});
      if (attempt === 3) return new Response(new ReadableStream({ cancel() { canceled++; } }));
      return new Response('{}');
    } });
    const oversized = await invoke(route);
    assert.equal(oversized.status, 502); assert.deepEqual(JSON.parse(oversized.body), { error: 'GBFS upstream response too large' });
    for (let i = 0; i < 2; i++) { const res = await invoke(route); assert.equal(res.status, 504); assert.deepEqual(JSON.parse(res.body), { error: 'GBFS upstream timeout' }); }
    assert.equal(canceled, 2); assert.equal((await invoke(route)).status, 200);
  });
}
