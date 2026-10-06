import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { voiceDiagnosticRecord } from './voiceDiagnosticRecord.js';
import { GevRealtimeController } from './gevRealtime.js';
import { openAiRealtimeProxy } from '../../vite.config.js';
import { createVoiceDiagnosticHandler, createVoiceDiagnosticSink, VOICE_DIAGNOSTIC_FILENAME,
  VOICE_DIAGNOSTIC_MAX_BYTES, VOICE_DIAGNOSTIC_REQUEST_BYTES } from '../../server/voiceDiagnostics.js';

const PRIVATE = 'PRIVATE TRANSCRIPT KEY VENUE TOOL RESULT';
const record = { event: 'tool.result', status: 'executing', payload: { text: PRIVATE }, sessionId: PRIVATE, loggedAt: PRIVATE };

async function invoke(handler, method = 'POST') {
  const response = { statusCode: 200, headers: {}, setHeader(key, value) { this.headers[key] = value; }, end(body = '') { this.body = body; } };
  await handler({ method, headers: { host: '127.0.0.1:5173', 'sec-fetch-site': 'same-origin' }, socket: { remoteAddress: '127.0.0.1', localPort: 5173 } }, response);
  assert.equal(response.headers['Cache-Control'], 'no-store');
  return response;
}

test('diagnostics allow only fixed event/status values, ignoring arbitrary nested contents', () => {
  assert.deepEqual(voiceDiagnosticRecord(record), { event: 'tool.result', status: 'executing' });
  assert.deepEqual(voiceDiagnosticRecord({ event: 'error', status: PRIVATE }), { event: 'error', status: 'unknown' });
  for (const value of [null, [], PRIVATE, { event: PRIVATE }, { event: 'constructor' }]) assert.equal(voiceDiagnosticRecord(value), null);
  const guarded = { event: 'error', status: 'error', get payload() { throw Error('Must not read'); } };
  assert.deepEqual(voiceDiagnosticRecord(guarded), { event: 'error', status: 'error' });
});

test('client logging is off by default without serializing payload or sending requests', () => {
  const oldFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = () => { calls++; throw Error('Unexpected network'); };
  try {
    const payload = { toJSON() { throw Error('Must not serialize'); } };
    GevRealtimeController.prototype.debugLog.call({ status: 'idle' }, 'error', payload);
    assert.equal(calls, 0);
  } finally { globalThis.fetch = oldFetch; }
});

test('disabled server route neither reads input nor calls the sink', async () => {
  let calls = 0;
  const handler = createVoiceDiagnosticHandler({ enabled: () => false,
    readBody: () => { calls++; throw Error(PRIVATE); }, append: () => { calls++; } });
  assert.equal((await invoke(handler)).statusCode, 403);
  assert.equal((await invoke(handler, 'GET')).statusCode, 405);
  assert.equal(calls, 0);
});

for (const hook of ['configureServer', 'configurePreviewServer']) {
  test(`${hook}: default and non-explicit settings keep actual debug route disabled`, async () => {
    for (const setting of [undefined, '0', 'true', 'yes']) {
      const routes = new Map();
      openAiRealtimeProxy({ env: { GEV_VOICE_DIAGNOSTICS: setting } })[hook]({ middlewares: { use: (url, handler) => routes.set(url, handler) } });
      assert.equal((await invoke(routes.get('/api/realtime/debug-log'))).statusCode, 403);
    }
  });
}

test('enabled server normalizes old/full clients before appending and bounds the read request', async () => {
  const written = [];
  const handler = createVoiceDiagnosticHandler({ enabled: () => true,
    readBody: async (_req, max) => { assert.equal(max, 4096); assert.equal(max, VOICE_DIAGNOSTIC_REQUEST_BYTES); return JSON.stringify(record); },
    append: value => { written.push(value); return true; } });
  assert.equal((await invoke(handler)).statusCode, 204);
  assert.deepEqual(written, [{ event: 'tool.result', status: 'executing' }]);
});

test('malformed/read/write failures expose no submitted values or filesystem details', async () => {
  for (const [readBody, append] of [
    [async () => `{${PRIVATE}`, () => assert.fail('Must not write')],
    [async () => { throw Error(PRIVATE); }, () => assert.fail('Must not write')],
    [async () => JSON.stringify(record), () => { throw Error(PRIVATE); }],
    [async () => JSON.stringify({ event: PRIVATE }), () => assert.fail('Must not write')],
  ]) {
    const response = await invoke(createVoiceDiagnosticHandler({ enabled: () => true, readBody, append }));
    assert.equal(response.statusCode, 400);
    assert.equal(response.body.includes(PRIVATE), false);
  }
});

test('full logs fail explicitly instead of reporting a successful append', async () => {
  const response = await invoke(createVoiceDiagnosticHandler({ enabled: () => true, readBody: async () => JSON.stringify(record), append: () => false }));
  assert.equal(response.statusCode, 507);
});

function fixture(t) {
  const parent = path.resolve(os.tmpdir());
  const directory = fs.mkdtempSync(path.join(parent, 'trexx-diagnostic-test-'));
  t.after(() => {
    // Only remove the test-owned temporary directory, never the application's logs.
    assert.equal(path.dirname(directory), parent);
    assert.ok(path.basename(directory).startsWith('trexx-diagnostic-test-'));
    fs.rmSync(directory, { recursive: true, force: true });
  });
  return directory;
}

test('disk sink writes only metadata with server time, preserving legacy conversation logs', t => {
  const directory = fixture(t);
  const legacy = path.join(directory, 'realtime-conversations.jsonl');
  fs.writeFileSync(legacy, PRIVATE);
  const append = createVoiceDiagnosticSink(directory, { now: () => new Date('2026-10-05T12:00:00Z') });
  assert.equal(append(record), true);
  const text = fs.readFileSync(path.join(directory, VOICE_DIAGNOSTIC_FILENAME), 'utf8');
  assert.deepEqual(JSON.parse(text), { loggedAt: '2026-10-05T12:00:00.000Z', event: 'tool.result', status: 'executing' });
  assert.equal(text.includes(PRIVATE), false);
  assert.equal(fs.readFileSync(legacy, 'utf8'), PRIVATE);
});

test('disk sink accepts the exact cap, then refuses growth without truncating existing contents', t => {
  const directory = fixture(t);
  const file = path.join(directory, VOICE_DIAGNOSTIC_FILENAME);
  const append = createVoiceDiagnosticSink(directory, { now: () => new Date('2026-10-05T12:00:00Z') });
  append(record);
  const line = fs.readFileSync(file);
  fs.writeFileSync(file, Buffer.alloc(VOICE_DIAGNOSTIC_MAX_BYTES - line.length, 32));
  assert.equal(append(record), true);
  const before = fs.readFileSync(file);
  assert.equal(before.length, VOICE_DIAGNOSTIC_MAX_BYTES);
  assert.equal(append(record), false);
  assert.deepEqual(fs.readFileSync(file), before);
});

test('sink rejects invalid records without creating its directory', t => {
  const directory = path.join(fixture(t), 'not-created');
  assert.throws(() => createVoiceDiagnosticSink(directory)({ event: PRIVATE }), /Invalid/);
  assert.equal(fs.existsSync(directory), false);
});
