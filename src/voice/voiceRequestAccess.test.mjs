import assert from 'node:assert/strict';
import test from 'node:test';
import { Readable } from 'node:stream';
import { isLocalVoiceRequest, withLocalVoiceAccess } from '../../server/voiceRequestAccess.js';
import { openAiRealtimeProxy } from '../../vite.config.js';

function request(headers = {}, socket = {}) {
  return { headers: { host: '127.0.0.1:5173', 'sec-fetch-site': 'same-origin', 'sec-fetch-mode': 'cors', 'sec-fetch-dest': 'empty', ...headers },
    socket: { remoteAddress: '127.0.0.1', localPort: 5173, ...socket } };
}
const deniedHeaders = [
  { origin: 'https://foreign.example' }, { origin: 'null' }, { origin: '' },
  { origin: 'http://localhost:5173' }, { origin: 'http://127.0.0.1:5174' },
  { origin: 'https://127.0.0.1:5173' }, { origin: 'http://127.0.0.1:5173/' },
  { origin: ['http://127.0.0.1:5173'] },
  { 'sec-fetch-site': 'cross-site' }, { 'sec-fetch-site': 'same-site' },
  { 'sec-fetch-site': 'none' }, { 'sec-fetch-site': '' },
  { 'sec-fetch-mode': 'navigate' }, { 'sec-fetch-mode': 'no-cors' },
  { 'sec-fetch-dest': 'image' }, { 'sec-fetch-dest': 'iframe' },
  { host: 'rebound.example:5173' }, { host: '127.0.0.1.attacker.example:5173' },
  { host: '127.0.0.1:5174' }, { host: '127.0.0.1:65536' },
  { host: 'user@127.0.0.1:5173' }, { host: '127.0.0.1:5173/path' },
  { host: '127.0.0.1:5173, foreign.example' }, { host: undefined },
  { host: ['127.0.0.1:5173'] }, { host: '127.1:5173' },
  { 'sec-fetch-site': undefined, referer: 'http://127.0.0.1:5173/' },
  { 'sec-fetch-site': undefined, 'x-forwarded-host': '127.0.0.1:5173', 'x-forwarded-proto': 'http' },
];

test('same-origin local fetch supports IPv4, localhost, IPv6 and TLS on the socket port', () => {
  for (const [host, peer] of [['127.0.0.1', '127.0.0.1'], ['localhost', '::ffff:127.0.0.1'], ['[::1]', '::1']]) {
    for (const encrypted of [false, true]) {
      assert.equal(isLocalVoiceRequest(request({ host: `${host}:5173`, origin: `${encrypted ? 'https' : 'http'}://${host}:5173` }, { encrypted, remoteAddress: peer })), true);
    }
  }
  assert.equal(isLocalVoiceRequest(request({ host: 'localhost', origin: 'http://localhost' }, { localPort: 80 })), true);
});

test('same-origin GET metadata works without Origin; exact Origin works without metadata', () => {
  assert.equal(isLocalVoiceRequest(request()), true);
  const req = request(); req.headers = { host: '127.0.0.1:5173', origin: 'http://127.0.0.1:5173' };
  assert.equal(isLocalVoiceRequest(req), true);
  delete req.headers.origin;
  assert.equal(isLocalVoiceRequest(req), false);
});

test('conflicting, absent, malformed, foreign and navigation evidence fails closed', () => {
  for (const headers of deniedHeaders) assert.equal(isLocalVoiceRequest(request(headers)), false, JSON.stringify(headers));
  assert.equal(isLocalVoiceRequest(request({ origin: 'http://127.0.0.1:5173', 'sec-fetch-site': 'cross-site' })), false);
  for (const remoteAddress of ['192.168.1.2', '::ffff:192.168.1.2', '10.0.0.1', undefined]) {
    assert.equal(isLocalVoiceRequest(request({ 'x-forwarded-for': '127.0.0.1' }, { remoteAddress })), false);
  }
  assert.equal(isLocalVoiceRequest({}), false);
});

function response() {
  return { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(body = '') { this.body = String(body); } };
}

test('denial precedes body access, diagnostics and downstream execution, and closes connection', async () => {
  let calls = 0;
  const guarded = withLocalVoiceAccess(() => { calls++; });
  const req = request({ origin: 'https://foreign.example' });
  req.on = () => assert.fail('Must not read the rejected body');
  const res = response(); await guarded(req, res);
  assert.equal(calls, 0); assert.equal(res.statusCode, 403);
  assert.equal(res.headers['Cache-Control'], 'no-store');
  assert.equal(res.headers.Connection, 'close');
  assert.equal(res.body.includes('foreign.example'), false);
  await guarded(request(), response()); assert.equal(calls, 1);
});

for (const hook of ['configureServer', 'configurePreviewServer']) {
  test(`${hook}: all three actual voice routes reject before secrets, throttle, reads or writes`, async () => {
    const handlers = new Map();
    const env = { get OPENAI_API_KEY() { assert.fail('Must not read key'); }, get GEV_VOICE_DIAGNOSTICS() { assert.fail('Must not enter diagnostic handler'); } };
    openAiRealtimeProxy({ env, rateLimiter: () => assert.fail('Must not throttle'), fetchImpl: () => assert.fail('Must not call provider') })[hook]({ middlewares: { use: (path, handler) => handlers.set(path, handler) } });
    assert.equal(handlers.size, 3);
    for (const handler of handlers.values()) for (const headers of deniedHeaders) {
      const req = { ...request(headers), method: 'POST', on: () => assert.fail('Must not read') };
      const res = response(); await handler(req, res);
      assert.equal(res.statusCode, 403); assert.equal(res.headers['Cache-Control'], 'no-store');
    }
  });

  test(`${hook}: valid local token/HUD requests and disabled diagnostics still work`, async () => {
    const handlers = new Map(); let calls = 0;
    openAiRealtimeProxy({ env: { OPENAI_API_KEY: 'synthetic-only' }, rateLimiter: () => null,
      fetchImpl: async url => { calls++; return Response.json(url.includes('client_secrets') ? { value: 'temporary' } : { output_text: 'one two three four five' }); },
    })[hook]({ middlewares: { use: (path, handler) => handlers.set(path, handler) } });
    for (const [path, method, expected] of [['/api/realtime/token', 'GET', 200], ['/api/realtime/token', 'POST', 200], ['/api/openai/hud-summary', 'POST', 200], ['/api/realtime/debug-log', 'POST', 403]]) {
      const req = Readable.from([Buffer.from('{}')]); Object.assign(req, request(), { method, url: '/' });
      const res = response(); await handlers.get(path)(req, res);
      assert.equal(res.statusCode, expected); assert.equal(res.headers['Cache-Control'], 'no-store');
      if (path.endsWith('debug-log')) assert.match(res.body, /disabled/);
      req.destroy();
    }
    assert.equal(calls, 3);
  });
}
