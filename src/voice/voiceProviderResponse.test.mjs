import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchVoiceProviderText, VOICE_PROVIDER_MAX_BYTES, VOICE_PROVIDER_TIMEOUT_MS } from '../../server/voiceProviderResponse.js';

const URL = 'https://api.openai.com/v1/realtime/client_secrets';
const request = (fetchImpl, timeoutMs = 1000) => fetchVoiceProviderText(URL, {}, { fetchImpl, timeoutMs });

test('voice fetch enforces redirect rejection and its own abort signal', async () => {
  assert.equal(VOICE_PROVIDER_TIMEOUT_MS, 15000);
  assert.equal(VOICE_PROVIDER_MAX_BYTES, 262144);
  let options;
  const result = await fetchVoiceProviderText(URL, { redirect: 'follow', method: 'POST' }, {
    fetchImpl: async (_url, value) => { options = value; return new Response('okay'); },
  });
  assert.equal(options.redirect, 'error');
  assert.equal(options.method, 'POST');
  assert.ok(options.signal instanceof AbortSignal);
  assert.equal(options.signal.aborted, false);
  assert.equal(result.text, 'okay');
});

test('exact byte cap accepts split Unicode and UTF-8 BOM decoding matches fetch text', async () => {
  const bytes = Buffer.from('\ufeff🌍' + ' '.repeat(VOICE_PROVIDER_MAX_BYTES - 7));
  assert.equal(bytes.length, VOICE_PROVIDER_MAX_BYTES);
  const result = await request(async () => new Response(new ReadableStream({ start(controller) {
    controller.enqueue(bytes.subarray(0, 5));
    controller.enqueue(bytes.subarray(5));
    controller.close();
  } })));
  assert.equal(result.text, '🌍' + ' '.repeat(VOICE_PROVIDER_MAX_BYTES - 7));
});

test('declared oversized success rejects without reading and does not await cancellation acknowledgement', async () => {
  let canceled = 0, released = 0, reads = 0;
  await assert.rejects(request(async () => ({ ok: true,
    headers: new Headers({ 'content-length': String(VOICE_PROVIDER_MAX_BYTES + 1) }),
    body: { getReader: () => ({ read() { reads++; }, cancel() { canceled++; return new Promise(() => {}); }, releaseLock() { released++; } }) },
  })), /too large/);
  assert.equal(reads, 0); assert.equal(canceled, 1); assert.equal(released, 1);
});

test('missing or understated length cannot bypass actual byte counts', async () => {
  for (const headers of [{}, { 'content-length': '1' }]) {
    let canceled = 0;
    await assert.rejects(request(async () => new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(VOICE_PROVIDER_MAX_BYTES));
        controller.enqueue(new Uint8Array(1));
      }, cancel() { canceled++; },
    }), { headers })), /too large/);
    assert.equal(canceled, 1);
  }
});

test('byte limit counts multibyte data rather than JavaScript characters', async () => {
  const text = '中'.repeat(Math.ceil(VOICE_PROVIDER_MAX_BYTES / 3));
  assert.ok(text.length < VOICE_PROVIDER_MAX_BYTES);
  await assert.rejects(request(async () => new Response(text)), /too large/);
});

test('deadline aborts a never-settling fetch and cancels a late response', async () => {
  let release, signal, canceled = 0;
  const pending = request((_url, options) => { signal = options.signal; return new Promise(resolve => { release = resolve; }); }, 10);
  await assert.rejects(pending, /timed out/);
  assert.equal(signal.aborted, true);
  release({ body: { cancel() { canceled++; return Promise.resolve(); } } });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(canceled, 1);
});

test('same deadline covers a stalled body and releases the reader without waiting for cancel', async () => {
  let signal, canceled = 0, released = 0;
  const response = { ok: true, headers: new Headers(), body: { getReader: () => ({
    read: () => new Promise(() => {}),
    cancel() { canceled++; return new Promise(() => {}); },
    releaseLock() { released++; },
  }) } };
  await assert.rejects(request(async (_url, options) => { signal = options.signal; return response; }, 10), /timed out/);
  assert.equal(signal.aborted, true); assert.equal(canceled, 1); assert.equal(released, 1);
});

test('non-success bodies are canceled but never read, including cancellation rejection', async () => {
  let canceled = 0;
  const response = { ok: false, status: 429, body: { cancel() { canceled++; return Promise.reject(Error('private')); } },
    text() { assert.fail('Must not read'); }, json() { assert.fail('Must not read'); } };
  const result = await request(async () => response);
  assert.equal(result.response.status, 429); assert.equal(result.text, null); assert.equal(canceled, 1);
});

test('stream failures release ownership and independent requests can retry', async () => {
  const response = new Response(new ReadableStream({ start(controller) { controller.error(Error('stream failed')); } }));
  await assert.rejects(request(async () => response), /stream failed/);
  assert.equal(response.body.locked, false);
  assert.equal((await request(async () => new Response('retry'))).text, 'retry');
});
