import assert from 'node:assert/strict';
import test from 'node:test';
import { Readable } from 'node:stream';
import { openAiRealtimeProxy } from '../../vite.config.js';

const TOKEN = '/api/realtime/token';
const HUD = '/api/openai/hud-summary';
const PRIVATE = 'synthetic-secret-and-private-context';

function routes(options = {}, hook = 'configureServer') {
  const handlers = new Map();
  const plugin = openAiRealtimeProxy({
    env: { OPENAI_API_KEY: PRIVATE },
    rateLimiter: () => null,
    fetchImpl: async () => { throw Error('Unexpected upstream call'); },
    ...options,
  });
  plugin[hook]({ middlewares: { use: (path, handler) => handlers.set(path, handler) } });
  return handlers;
}

async function invoke(handlers, route, { method = route === TOKEN ? 'GET' : 'POST', body = '{}', url = '/' } = {}) {
  const req = Readable.from([Buffer.from(body)]);
  Object.assign(req, { method, url, headers: {}, socket: { remoteAddress: '127.0.0.1' } });
  const result = { status: 200, headers: {}, body: '', ended: false };
  const res = {
    set statusCode(value) { result.status = value; },
    setHeader(name, value) { result.headers[name.toLowerCase()] = value; },
    end(body = '') { result.body = String(body); result.ended = true; },
  };
  await handlers.get(route)(req, res);
  assert.equal(result.ended, true);
  assert.equal(result.headers['cache-control'], 'no-store');
  return result;
}

for (const hook of ['configureServer', 'configurePreviewServer']) {
  test(`${hook}: token success preserves the temporary credential and tier echo without caching`, async () => {
    let request;
    const body = JSON.stringify({ value: 'synthetic-ephemeral-value', expires_at: 12345 });
    const handlers = routes({ fetchImpl: async (url, options) => {
      request = { url, options };
      return new Response(body, { headers: { 'Content-Type': 'application/json' } });
    } }, hook);
    const result = await invoke(handlers, TOKEN, { url: '/?tier=mini' });
    assert.equal(result.status, 200);
    assert.equal(result.body, body);
    assert.equal(result.headers['x-gev-voice-tier'], 'mini');
    assert.equal(request.url, 'https://api.openai.com/v1/realtime/client_secrets');
    assert.equal(request.options.headers.Authorization, `Bearer ${PRIVATE}`);
    assert.equal(JSON.parse(request.options.body).session.type, 'realtime');
    assert.equal(result.body.includes(PRIVATE), false);
    const fallback = await invoke(handlers, TOKEN, { method: 'POST', url: '/?tier=hostile-model' });
    assert.equal(fallback.headers['x-gev-voice-tier'], 'standard');
    assert.equal(fallback.headers['x-gev-voice-tier-fallback'], '1');
  });

  for (const route of [TOKEN, HUD]) {
    test(`${hook}: ${route} suppresses upstream failures without reading or caching their bodies`, async () => {
      for (const status of [302, 401, 429, 500]) {
        let canceled = 0;
        const handlers = routes({ fetchImpl: async () => ({
          ok: false, status,
          body: { cancel() { canceled++; return new Promise(() => {}); } },
          text() { throw Error(PRIVATE); },
          json() { throw Error(PRIVATE); },
        }) }, hook);
        const result = await invoke(handlers, route);
        assert.equal(result.status, status >= 400 ? status : 502);
        assert.equal(canceled, 1);
        assert.equal(result.body.includes(PRIVATE), false);
        assert.equal(JSON.parse(result.body).error, route === TOKEN ? 'Failed to create Realtime token' : 'OpenAI HUD summary request failed');
        if (route === HUD) assert.equal(JSON.parse(result.body).summary, null);
      }
    });

    test(`${hook}: ${route} hides thrown errors and response-read failures`, async () => {
      for (const fetchImpl of [
        async () => { throw Error(PRIVATE); },
        async () => ({ ok: true, status: 200, text: async () => { throw Error(PRIVATE); }, json: async () => { throw Error(PRIVATE); } }),
      ]) {
        const result = await invoke(routes({ fetchImpl }, hook), route);
        assert.equal(result.status, 502);
        assert.equal(result.body.includes(PRIVATE), false);
      }
    });

    test(`${hook}: ${route} method, missing-key and throttle failures do not fetch or cache`, async () => {
      let calls = 0;
      const fetchImpl = async () => { calls++; throw Error(PRIVATE); };
      const method = await invoke(routes({ fetchImpl }, hook), route, { method: 'DELETE' });
      assert.equal(method.status, 405);
      const disabled = await invoke(routes({ fetchImpl, env: {} }, hook), route);
      assert.equal(disabled.status, 501);
      assert.equal(JSON.parse(disabled.body).disabled, true);
      const throttled = await invoke(routes({ fetchImpl, rateLimiter: () => () => false }, hook), route);
      assert.equal(throttled.status, 429);
      assert.equal(throttled.headers['retry-after'], '5');
      assert.equal(calls, 0);
    });
  }

  test(`${hook}: HUD only returns normalized summary text, never other provider fields`, async () => {
    const handlers = routes({ fetchImpl: async (url) => {
      assert.equal(url, 'https://api.openai.com/v1/responses');
      return Response.json({ output_text: 'One two three four five six', error: { message: PRIVATE }, internal: PRIVATE });
    } }, hook);
    const result = await invoke(handlers, HUD);
    assert.equal(result.status, 200);
    assert.deepEqual(JSON.parse(result.body), { summary: 'One two three four five', error: null });
  });

  test(`${hook}: malformed input and empty or malformed HUD replies use generic errors`, async () => {
    let calls = 0;
    const handlers = routes({ fetchImpl: async () => { calls++; return Response.json({}); } }, hook);
    const invalid = await invoke(handlers, HUD, { body: `{"private":"${PRIVATE}"` });
    assert.equal(invalid.status, 502);
    assert.equal(invalid.body.includes(PRIVATE), false);
    assert.equal(calls, 0);
    const empty = await invoke(handlers, HUD);
    assert.equal(empty.status, 502);
    assert.equal(JSON.parse(empty.body).summary, null);
    const malformed = await invoke(routes({ fetchImpl: async () => new Response(PRIVATE) }, hook), HUD);
    assert.equal(malformed.status, 502);
    assert.equal(malformed.body.includes(PRIVATE), false);
  });
}
