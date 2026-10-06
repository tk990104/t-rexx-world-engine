import assert from 'node:assert/strict';
import test from 'node:test';
import { PassThrough, Readable } from 'node:stream';
import { openRouterProxy, OPENROUTER_OPERATION_TIMEOUT_MS } from '../../vite.config.js';
import { VOICE_PROVIDER_MAX_BYTES } from '../../server/voiceProviderResponse.js';

const PRIVATE = 'synthetic-secret-and-provider-error';
const CHAT = JSON.stringify({ system: 'system prompt', messages: [{ role: 'user', content: 'hello' }], maxTokens: 500 });
const success = () => Response.json({ choices: [{ message: { content: ' safe reply ' } }], private: PRIVATE });
function context(url = '/chat', method = 'POST', headers = {}) {
  return { url, method, headers: { host: '127.0.0.1:5173', 'sec-fetch-site': 'same-origin', ...headers }, socket: { remoteAddress: '127.0.0.1', localPort: 5173 } };
}
function response() {
  return { statusCode: 200, headers: {}, headersSent: false, body: '',
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    writeHead(status, headers) { this.statusCode = status; for (const [k, v] of Object.entries(headers)) this.setHeader(k, v); },
    end(body = '') { this.body = String(body); this.headersSent = true; },
  };
}
function handler(hook, options = {}) {
  let handle;
  openRouterProxy({ env: { OPENROUTER_API_KEY: PRIVATE, OPENAI_API_KEY: PRIVATE }, fetchImpl: () => assert.fail('Unexpected provider call'), ...options })[hook]({ middlewares: { use(path, fn) { assert.equal(path, '/api/openrouter'); handle = fn; } } });
  return handle;
}
async function invoke(handle, { body = CHAT, url = '/chat', method = 'POST', headers = {} } = {}) {
  const req = Readable.from([Buffer.from(body)]); Object.assign(req, context(url, method, headers));
  const res = response(); await handle(req, res);
  assert.equal(res.headers['cache-control'], 'no-store');
  assert.equal(res.body.includes(PRIVATE), false);
  req.destroy(); return res;
}

test('OpenRouter fallback default budget is thirty seconds', () => assert.equal(OPENROUTER_OPERATION_TIMEOUT_MS, 30000));

for (const hook of ['configureServer', 'configurePreviewServer']) {
  test(`${hook}: status returns booleans/models only; unsupported methods and paths do not fetch`, async () => {
    const handle = handler(hook);
    const status = await invoke(handle, { url: '/status', method: 'GET' });
    assert.equal(status.statusCode, 200);
    const data = JSON.parse(status.body);
    assert.deepEqual(Object.keys(data).sort(), ['configured', 'models', 'realtimeConfigured']);
    assert.equal(data.configured, true); assert.equal(data.realtimeConfigured, true); assert.equal(data.models.length, 8);
    const disabled = JSON.parse((await invoke(handler(hook, { env: {} }), { url: '/status', method: 'GET' })).body);
    assert.equal(disabled.configured, false); assert.equal(disabled.realtimeConfigured, false);
    for (const [url, method] of [['/status', 'POST'], ['/chat', 'GET'], ['/other', 'POST']]) {
      assert.equal((await invoke(handle, { url, method })).statusCode, 405);
    }
  });

  test(`${hook}: local-origin checks reject before key lookup, input reads or provider calls`, async () => {
    const handle = handler(hook, { env: { get OPENROUTER_API_KEY() { assert.fail('Must not read key'); } } });
    for (const url of ['/status', '/chat']) for (const headers of [
      { origin: 'https://foreign.example' }, { 'sec-fetch-site': 'same-site' },
      { host: 'rebound.example:5173' }, { 'sec-fetch-site': undefined }, { 'sec-fetch-mode': 'navigate' },
    ]) {
      const req = { ...context(url, 'POST', headers), on() { assert.fail('Must not read upload'); } };
      const res = response(); await handle(req, res);
      assert.equal(res.statusCode, 403); assert.equal(res.headers.connection, 'close');
      assert.equal(res.headers['cache-control'], 'no-store');
    }
  });

  test(`${hook}: valid chat preserves system/messages, token cap and fixed model order`, async () => {
    const sent = [];
    const handle = handler(hook, { fetchImpl: async (url, options) => {
      assert.equal(url, 'https://openrouter.ai/api/v1/chat/completions');
      assert.equal(options.redirect, 'error'); assert.ok(options.signal instanceof AbortSignal);
      assert.equal(options.headers.Authorization, `Bearer ${PRIVATE}`);
      sent.push(JSON.parse(options.body));
      return sent.length === 1 ? new Response(PRIVATE, { status: 429 }) : success();
    } });
    const res = await invoke(handle, { body: JSON.stringify({ ...JSON.parse(CHAT), maxTokens: 9000 }) });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(sent.map(x => x.model), ['nvidia/nemotron-3-ultra-550b-a55b:free', 'minimax/minimax-m3:free']);
    assert.equal(sent[0].max_tokens, 2000);
    assert.deepEqual(sent[0].messages, [{ role: 'system', content: 'system prompt' }, { role: 'user', content: 'hello' }]);
    assert.deepEqual(JSON.parse(res.body), { text: 'safe reply', model: sent[1].model });
  });

  test(`${hook}: provider failures are generic and fallback is bounded to the fixed list`, async () => {
    for (const bad of [() => { throw Error(PRIVATE); }, () => new Response('{bad'),
      () => Response.json({ error: { message: PRIVATE } }),
      () => Response.json({ choices: [{ message: { content: {} } }] }),
    ]) {
      let calls = 0;
      const res = await invoke(handler(hook, { fetchImpl: () => { calls++; return bad(); } }));
      assert.equal(res.statusCode, 502); assert.equal(calls, 8);
      assert.deepEqual(JSON.parse(res.body), { error: 'OpenRouter request failed' });
    }
    assert.equal((await invoke(handler(hook, { env: {} }))).statusCode, 502);
  });

  test(`${hook}: non-OK errors are canceled unread; oversized responses cancel and allow fallback`, async () => {
    let calls = 0, cancels = 0;
    const handle = handler(hook, { fetchImpl: async () => {
      calls++;
      if (calls === 1) return { ok: false, status: 500, body: { cancel() { cancels++; return Promise.resolve(); }, getReader() { assert.fail('Must not read provider error'); } } };
      if (calls === 2) return new Response(new ReadableStream({ start(c) { c.enqueue(new Uint8Array(VOICE_PROVIDER_MAX_BYTES + 1)); }, cancel() { cancels++; } }));
      if (calls === 3) return new Response(new ReadableStream({ cancel() { cancels++; } }), { headers: { 'content-length': String(VOICE_PROVIDER_MAX_BYTES + 1) } });
      return success();
    } });
    const res = await invoke(handle);
    assert.equal(res.statusCode, 200); assert.equal(calls, 4); assert.equal(cancels, 3);
  });

  test(`${hook}: all fallback attempts share one deadline and fresh requests can retry`, { timeout: 3000 }, async () => {
    let retry = false, calls = 0;
    const signals = [];
    const handle = handler(hook, { operationTimeoutMs: 45, upstreamTimeoutMs: 30,
      fetchImpl: async (_url, options) => { calls++; signals.push(options.signal); return retry ? success() : new Promise(() => {}); },
    });
    const started = performance.now(); const failure = await invoke(handle);
    assert.equal(failure.statusCode, 502); assert.ok(calls >= 1 && calls < 8);
    assert.ok(performance.now() - started < 2000);
    assert.ok(signals.every(signal => signal.aborted));
    retry = true; assert.equal((await invoke(handle)).statusCode, 200);
  });

  test(`${hook}: missing/malformed input and oversize upload never call provider`, async () => {
    const handle = handler(hook);
    for (const body of ['null', '[]', '{bad', '{}', '{"messages":[]}']) assert.equal((await invoke(handle, { body })).statusCode, 400);
    const req = new PassThrough(); Object.assign(req, context());
    const res = response(); const pending = handle(req, res);
    req.write(Buffer.alloc(64 * 1024 + 1)); await pending;
    assert.equal(res.statusCode, 400); assert.equal(req.destroyed, true);
    assert.equal(res.body.includes(PRIVATE), false);
  });

  test(`${hook}: stalled/aborted uploads fail before provider work and permit valid retry`, async () => {
    let calls = 0;
    const handle = handler(hook, { requestTimeoutMs: 20, fetchImpl: async () => { calls++; return success(); } });
    for (const abort of [false, true]) {
      const req = new PassThrough(); Object.assign(req, context()); const res = response();
      const pending = handle(req, res); req.write(Buffer.from('{'));
      if (abort) req.emit('aborted');
      await pending; assert.equal(res.statusCode, 400); assert.equal(req.destroyed, true);
      assert.equal(calls, 0);
      for (const event of ['data', 'end', 'error', 'aborted', 'close']) assert.equal(req.listenerCount(event), 0);
    }
    assert.equal((await invoke(handle)).statusCode, 200); assert.equal(calls, 1);
  });
}
