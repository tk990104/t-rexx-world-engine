import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readVoiceConfiguration, installVoiceFallback } from './voiceFallback.js';

test('availability reads only configuration and returns no provider data', async () => {
  const requests = [];
  const state = await readVoiceConfiguration(async (url) => {
    requests.push(url);
    return { ok: true, json: async () => ({ realtimeConfigured: false, configured: true, secret: 'never-return' }) };
  });
  assert.deepEqual(requests, ['/api/openrouter/status']);
  assert.deepEqual(state, { realtimeConfigured: false, freeModelConfigured: true });
});

test('invalid, unavailable and hung configuration reads are bounded and unknown', async () => {
  for (const fetchImpl of [async () => { throw Error('offline'); }, async () => ({ ok: false }),
    async () => ({ ok: true, json: async () => ({ configured: true }) }),
    async () => ({ ok: true, json: async () => ({ configured: true, realtimeConfigured: 'false' }) }),
    () => new Promise(() => {})]) {
    assert.equal(await readVoiceConfiguration(fetchImpl, { timeoutMs: 10 }), null);
  }
  const abort = new AbortController(); abort.abort();
  assert.equal(await readVoiceConfiguration(() => { throw Error('must not fetch'); }, { signal: abort.signal }), null);
});

test('configured or active Realtime, unknown configuration and unsupported speech never replace controls', async () => {
  for (const [configured, active, supported, expected] of [[true, false, true, 'realtime'], [false, true, true, 'realtime'], [false, false, false, 'realtime'], [null, false, true, 'unknown']]) {
    const binding = installVoiceFallback({ document: { getElementById() { throw Error('must not touch UI'); } },
      realtime: { isActive: () => active }, freeVoice: { isSupported: () => supported },
      fetchImpl: async () => ({ ok: true, json: async () => ({ configured: false, realtimeConfigured: configured }) }) });
    assert.equal(await binding.ready, expected); binding.dispose(); binding.dispose();
  }
});

test('teardown cancels a delayed startup before touching controls', async () => {
  let resolve;
  const binding = installVoiceFallback({ document: { getElementById() { throw Error('late UI mutation'); } },
    realtime: {}, freeVoice: {}, fetchImpl: () => new Promise((r) => { resolve = r; }) });
  binding.dispose();
  assert.equal(await binding.ready, 'disposed');
  resolve({ ok: true, json: async () => ({ realtimeConfigured: false, configured: false }) });
});

test('main uses the tested binding without a startup token probe; server exposes only a boolean', () => {
  const main = readFileSync(new URL('../main.js', import.meta.url), 'utf8');
  const config = readFileSync(new URL('../../vite.config.js', import.meta.url), 'utf8');
  assert.match(main, /installVoiceFallback\(\{ realtime:/);
  assert.doesNotMatch(main, /fetch\(['"]\/api\/realtime\/token/);
  assert.equal(/realtimeConfigured: Boolean\(env\.OPENAI_API_KEY\)/.test(config), true,
    'status exposes only the injected environment presence boolean');
});
