import assert from 'node:assert/strict';
import test from 'node:test';
import { adsbLolProxy } from '../../vite.config.js';

const PRIVATE = 'synthetic-secret-token-C:/private/provider-error';
const SUCCESS = '{"ac":[{"hex":"abcdef"}],"total":1}';
function handler(hook, options) {
  let route;
  adsbLolProxy(options)[hook]({ middlewares: { use(path, fn) {
    assert.equal(path, '/api/adsblol/mil'); route = fn;
  } } });
  return route;
}
async function invoke(route) {
  const res = { writeHead(status, headers) { this.status = status; this.headers = headers; },
    end(body) { this.body = body; } };
  await route({ method: 'GET', url: '/' }, res);
  assert.equal(res.headers['Cache-Control'], 'no-store');
  assert.equal(res.body.includes(PRIVATE), false);
  return res;
}

for (const hook of ['configureServer', 'configurePreviewServer']) {
  test(`${hook}: upstream error bodies stay unread, uncached and retryable`, async () => {
    for (const status of [401, 403, 429, 503]) {
      let calls = 0, canceled = 0;
      const route = handler(hook, { fetchImpl: async url => {
        assert.equal(url, 'https://api.adsb.lol/v2/mil');
        if (++calls === 1) return { ok: false, status,
          text() { assert.fail('Must not read provider error body: ' + PRIVATE); },
          body: { cancel() { canceled++; return Promise.reject(Error(PRIVATE)); } } };
        return new Response(SUCCESS);
      } });
      const failed = await invoke(route);
      assert.equal(failed.status, status);
      assert.deepEqual(JSON.parse(failed.body), { error: 'ADS-B upstream request failed' });
      assert.equal(canceled, 1);
      assert.equal((await invoke(route)).body, SUCCESS);
      const cached = await invoke(route);
      assert.equal(cached.body, SUCCESS); assert.equal(cached.headers['X-ADS-B-Cache'], 'HIT');
      assert.equal(calls, 2);
    }
  });
  test(`${hook}: error-body cancellation cannot hold response open`, async () => {
    const route = handler(hook, { fetchImpl: async () => ({ ok: false, status: 502,
      text() { assert.fail('Must not read error'); },
      body: { cancel() { return new Promise(() => {}); } } }) });
    assert.equal((await invoke(route)).status, 502);
  });
  test(`${hook}: thrown provider values become fixed errors and later requests succeed`, async () => {
    for (const failure of [Error(PRIVATE), PRIVATE, null]) {
      let calls = 0;
      const route = handler(hook, { fetchImpl: async () => {
        if (++calls === 1) throw failure;
        return new Response(SUCCESS);
      } });
      const failed = await invoke(route);
      assert.equal(failed.status, 502);
      assert.deepEqual(JSON.parse(failed.body), { error: 'ADS-B proxy error' });
      assert.equal((await invoke(route)).body, SUCCESS);
    }
  });
  test(`${hook}: stream errors preserve stale success without caching the failure`, async () => {
    let clock = 1, calls = 0;
    const route = handler(hook, { now: () => clock, fetchImpl: async () => {
      calls++;
      if (calls === 2) return { ok: true, text: async () => { throw Error(PRIVATE); } };
      return new Response(SUCCESS);
    } });
    assert.equal((await invoke(route)).headers['X-ADS-B-Cache'], 'MISS');
    clock += 12001;
    const stale = await invoke(route);
    assert.equal(stale.status, 200); assert.equal(stale.body, SUCCESS);
    assert.equal(stale.headers['X-ADS-B-Cache'], 'STALE');
    assert.equal((await invoke(route)).headers['X-ADS-B-Cache'], 'MISS');
    assert.equal(calls, 3);
  });
  test(`${hook}: non-OK refresh does not poison a previous successful cache`, async () => {
    let clock = 1, calls = 0;
    const route = handler(hook, { now: () => clock, fetchImpl: async () => {
      calls++;
      if (calls === 1) return new Response(SUCCESS);
      if (calls === 2) return new Response(PRIVATE, { status: 503 });
      throw Error(PRIVATE);
    } });
    await invoke(route); clock += 12001;
    assert.equal((await invoke(route)).status, 503);
    const stale = await invoke(route);
    assert.equal(stale.body, SUCCESS); assert.equal(stale.headers['X-ADS-B-Cache'], 'STALE');
    assert.equal(calls, 3);
  });
}
