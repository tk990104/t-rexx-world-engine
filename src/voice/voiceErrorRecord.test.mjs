import assert from 'node:assert/strict';
import test from 'node:test';
import { createVoiceErrorRecord } from './voiceErrorRecord.js';
import { GevRealtimeController } from './gevRealtime.js';

const PRIVATE = 'PRIVATE transcript venue key https://private.example/session';

test('error records retain only fixed categories, states and a generated timestamp', () => {
  const record = createVoiceErrorRecord('Realtime API', { name: PRIVATE, message: PRIVATE, stack: PRIVATE, code: 'rate_limit_exceeded' }, {
    code: PRIVATE, source: PRIVATE, timestamp: PRIVATE, errorText: PRIVATE,
    url: PRIVATE, address: PRIVATE, responseId: PRIVATE, eventId: PRIVATE,
    connectionState: 'connected', iceConnectionState: 'completed', dataChannelState: 'open',
    nested: { note: PRIVATE },
  });
  assert.equal(record.source, 'Realtime API');
  assert.equal(record.code, 'rate_limit_exceeded');
  assert.match(record.message, /Wait before retrying/);
  assert.equal(record.connectionState, 'connected');
  assert.equal(record.iceConnectionState, 'completed');
  assert.equal(record.dataChannelState, 'open');
  assert.ok(Number.isFinite(Date.parse(record.timestamp)));
  assert.equal(JSON.stringify(record).includes(PRIVATE), false);
  assert.ok(Object.isFrozen(record));
  assert.throws(() => { record.message = PRIVATE; }, TypeError);
});

test('hostile unknown source, codes and states cannot become diagnostic strings', () => {
  for (const code of [PRIVATE, 'constructor', '__proto__', null, {}, ['NotAllowedError']]) {
    const record = createVoiceErrorRecord(PRIVATE, { name: code, message: PRIVATE, code }, {
      code, connectionState: PRIVATE, iceConnectionState: PRIVATE, dataChannelState: PRIVATE,
    });
    assert.equal(record.source, 'Voice');
    assert.equal(record.code, 'unknown');
    assert.deepEqual(Object.keys(record), ['timestamp', 'source', 'code', 'message']);
    assert.equal(JSON.stringify(record).includes(PRIVATE), false);
  }
});

test('recognized microphone and provider failures retain actionable guidance without raw messages', () => {
  for (const [code, guidance] of [
    ['NotAllowedError', /permissions/], ['NotFoundError', /input device/],
    ['NotReadableError', /in use/], ['AbortError', /interrupted/], ['NetworkError', /network/],
    ['invalid_api_key', /configuration/], ['insufficient_quota', /quota/],
    ['model_not_found', /model/], ['server_error', /later/], ['context_length_exceeded', /new session/],
  ]) {
    const record = createVoiceErrorRecord('Realtime connection', { error: { name: code, message: PRIVATE } });
    assert.equal(record.code, code);
    assert.match(record.message, guidance);
    assert.equal(record.message.includes(PRIVATE), false);
  }
  assert.equal(createVoiceErrorRecord('ICE candidate', null, { code: 'server_error' }).code, 'server_error');
});

test('discarded message/stack/extra fields are never inspected or serialized', () => {
  const unreadable = { get message() { throw Error('Must not read message'); }, get stack() { throw Error('Must not read stack'); } };
  const extra = { get errorText() { throw Error('Must not read extra'); }, toJSON() { throw Error('Must not serialize extras'); } };
  const record = createVoiceErrorRecord('Realtime API', unreadable, extra);
  assert.equal(record.code, 'unknown');
});

test('controller errors are bounded, memory-only, safe in reports/console/UI and isolated from mutations', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const originalConsole = console.error;
  const storageCalls = [], logged = [], displayed = [], diagnostic = [];
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem(key) { storageCalls.push(['get', key]); if (key === 'gev-realtime-errors') throw Error('Legacy history must not be read'); return null; },
    setItem(key) { storageCalls.push(['set', key]); throw Error('Must not write'); },
    removeItem(key) { storageCalls.push(['remove', key]); throw Error('Must not delete'); },
  } });
  console.error = (...args) => logged.push(args);
  try {
    const controller = new GevRealtimeController({ runner: async () => {}, ui: null });
    assert.deepEqual(controller.errors, []);
    controller.setStatus = (...args) => displayed.push(args);
    controller.debugLog = (...args) => diagnostic.push(args);
    for (let index = 0; index < 35; index++) {
      controller.reportError('Realtime API', { code: 'rate_limit_exceeded', message: PRIVATE }, { responseId: PRIVATE });
    }
    assert.equal(controller.errors.length, 30);
    assert.equal(storageCalls.some(([action, key]) => action !== 'get' || key === 'gev-realtime-errors'), false);
    const report = controller.getDiagnostics();
    assert.equal(report.recentErrors.length, 30);
    for (const surface of [report, logged, displayed, diagnostic]) assert.equal(JSON.stringify(surface).includes(PRIVATE), false);
    report.recentErrors[0].message = PRIVATE;
    report.recentErrors.pop();
    assert.equal(controller.errors.length, 30);
    assert.equal(JSON.stringify(controller.getDiagnostics()).includes(PRIVATE), false);
    const fresh = new GevRealtimeController({ runner: async () => {}, ui: null });
    assert.deepEqual(fresh.errors, []);
  } finally {
    console.error = originalConsole;
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete globalThis.localStorage;
  }
});
