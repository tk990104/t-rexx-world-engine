import assert from 'node:assert/strict';
import test from 'node:test';
import { PassThrough, Readable } from 'node:stream';
import { setTimeout as delay } from 'node:timers/promises';
import { readVoiceRequestBody, VOICE_REQUEST_TIMEOUT_MS } from '../../server/voiceRequestBody.js';
import { createVoiceDiagnosticHandler } from '../../server/voiceDiagnostics.js';
import { openAiRealtimeProxy } from '../../vite.config.js';

const PRIVATE = 'PRIVATE REQUEST AND ERROR';
const ownedEvents = ['data', 'end', 'aborted', 'error', 'close'];
const checkClean = req => { for (const event of ownedEvents) assert.equal(req.listenerCount(event), 0, event); };

test('bounded reader accepts exact bytes and split UTF-8 without destroying a completed request', async () => {
  assert.equal(VOICE_REQUEST_TIMEOUT_MS, 10000);
  const req = new PassThrough({ autoDestroy: false });
  const result = readVoiceRequestBody(req, 7, { timeoutMs: 100 });
  const bytes = Buffer.from('🌍abc');
  req.write(bytes.subarray(0, 2)); req.end(bytes.subarray(2));
  assert.equal(await result, '🌍abc');
  checkClean(req);
  assert.equal(req.destroyed, false);
  req.destroy();
});

test('empty completed request remains usable and cleanup preserves unrelated listeners', async () => {
  const req = new PassThrough({ autoDestroy: false });
  const unrelated = () => {};
  req.on('end', unrelated);
  const result = readVoiceRequestBody(req, 5);
  req.end();
  assert.equal(await result, '');
  assert.deepEqual(req.listeners('end'), [unrelated]);
  req.removeListener('end', unrelated);
  checkClean(req); req.destroy();
});

test('declared overflow rejects before reading, and actual overflow ignores absent/false headers', async () => {
  for (const length of [undefined, '1', '100']) {
    const req = new PassThrough();
    req.headers = { 'content-length': length };
    const result = readVoiceRequestBody(req, 5);
    const rejected = assert.rejects(result, /exceeds limits/);
    if (!req.destroyed) req.write(Buffer.from('中中'));
    await rejected;
    assert.equal(req.destroyed, true); checkClean(req);
  }
});

test('whole-read timeout closes a stalled or continually trickling request', async () => {
  for (const trickle of [false, true]) {
    const req = new PassThrough();
    const result = readVoiceRequestBody(req, 1024, { timeoutMs: 30 });
    const rejected = assert.rejects(result, /exceeds limits/);
    req.write(Buffer.from('a'));
    const timer = trickle ? setInterval(() => { if (!req.destroyed) req.write(Buffer.from('b')); }, 5) : null;
    try { await rejected; } finally { clearInterval(timer); }
    assert.equal(req.destroyed, true); checkClean(req);
  }
});

for (const event of ['aborted', 'close', 'error']) {
  test(`premature ${event} rejects generically, cleans listeners, and cannot later complete`, async () => {
    const req = new PassThrough();
    const result = readVoiceRequestBody(req, 4096);
    const rejected = assert.rejects(result, error => !error.message.includes(PRIVATE));
    req.write(Buffer.from(PRIVATE));
    req.emit(event, Error(PRIVATE));
    await rejected;
    req.emit('data', Buffer.from('late'));
    req.emit('end');
    assert.equal(req.destroyed, true); checkClean(req);
  });
}

test('already-aborted streams fail immediately; success clears the timer', async () => {
  const aborted = new PassThrough();
  aborted.aborted = true;
  await assert.rejects(readVoiceRequestBody(aborted, 20));
  assert.equal(aborted.destroyed, true); checkClean(aborted);
  const req = new PassThrough({ autoDestroy: false });
  const result = readVoiceRequestBody(req, 20, { timeoutMs: 10 });
  req.end(Buffer.from('valid'));
  assert.equal(await result, 'valid');
  await delay(25);
  assert.equal(req.destroyed, false); checkClean(req); req.destroy();
});

function response() {
  return { statusCode: 200, headers: {}, setHeader(key, value) { this.headers[key] = value; }, end(body = '') { this.body = String(body); } };
}

for (const hook of ['configureServer', 'configurePreviewServer']) {
  test(`${hook}: incomplete HUD uploads never call the provider and valid retry works`, async () => {
    let calls = 0;
    const handlers = new Map();
    openAiRealtimeProxy({ env: { OPENAI_API_KEY: 'synthetic-only' }, rateLimiter: () => null,
      requestTimeoutMs: 30, fetchImpl: async () => { calls++; return Response.json({ output_text: 'one two three four five' }); },
    })[hook]({ middlewares: { use: (path, handler) => handlers.set(path, handler) } });
    const handler = handlers.get('/api/openai/hud-summary');
    const requestContext = { method: 'POST', headers: { host: '127.0.0.1:5173', 'sec-fetch-site': 'same-origin' }, socket: { remoteAddress: '127.0.0.1', localPort: 5173 } };
    const req = new PassThrough(); Object.assign(req, requestContext);
    const res = response();
    const pending = handler(req, res);
    req.write(Buffer.from('{"unfinished":"'));
    await pending;
    assert.equal(calls, 0); assert.equal(req.destroyed, true);
    assert.equal(res.statusCode, 502); assert.equal(res.headers['Cache-Control'], 'no-store');
    const retry = Readable.from([Buffer.from('{}')]); Object.assign(retry, requestContext);
    const success = response(); await handler(retry, success);
    assert.equal(success.statusCode, 200); assert.equal(calls, 1);
  });
}

test('diagnostic handler never appends interrupted uploads and preserves its 4 KiB cap', async () => {
  let writes = 0;
  const handler = createVoiceDiagnosticHandler({ enabled: () => true,
    readBody: (req, limit) => { assert.equal(limit, 4096); return readVoiceRequestBody(req, limit, { timeoutMs: 20 }); },
    append: () => { writes++; return true; },
  });
  const req = new PassThrough(); req.method = 'POST';
  const res = response();
  const pending = handler(req, res);
  req.write(Buffer.from('{"event":"error"'));
  req.emit('aborted');
  await pending;
  assert.equal(writes, 0); assert.equal(res.statusCode, 400);
  assert.equal(res.headers['Cache-Control'], 'no-store'); checkClean(req);
});
