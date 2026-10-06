import { Buffer } from 'node:buffer';

export const VOICE_PROVIDER_MAX_BYTES = 256 * 1024;
export const VOICE_PROVIDER_TIMEOUT_MS = 15_000;

function cancel(body) {
  try { void body?.cancel().catch(() => {}); } catch { /* Cleanup must not delay failure. */ }
}

/** One deadline covers fetch and streamed body; provider errors are never read. */
export async function fetchVoiceProviderText(url, options, {
  fetchImpl = globalThis.fetch,
  timeoutMs = VOICE_PROVIDER_TIMEOUT_MS,
} = {}) {
  const controller = new AbortController();
  let reader;
  let complete = false;
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error('Voice provider timed out'));
    }, timeoutMs);
  });
  const operation = async () => {
    const response = await fetchImpl(url, { ...options, redirect: 'error', signal: controller.signal });
    // An abort-insensitive transport may settle after the caller has timed out.
    if (controller.signal.aborted) { cancel(response.body); throw new Error('Voice provider timed out'); }
    if (!response.ok) { cancel(response.body); return { response, text: null }; }
    reader = response.body?.getReader();
    if (!reader) throw new Error('Missing voice provider response');
    if (Number(response.headers.get('content-length')) > VOICE_PROVIDER_MAX_BYTES) {
      throw new Error('Voice provider response too large');
    }
    const buffer = Buffer.alloc(VOICE_PROVIDER_MAX_BYTES);
    let bytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (controller.signal.aborted) throw new Error('Voice provider timed out');
      if (done) { complete = true; break; }
      if (bytes + value.byteLength > VOICE_PROVIDER_MAX_BYTES) throw new Error('Voice provider response too large');
      buffer.set(value, bytes);
      bytes += value.byteLength;
    }
    return { response, text: new TextDecoder().decode(buffer.subarray(0, bytes)) };
  };
  try {
    return await Promise.race([operation(), deadline]);
  } finally {
    clearTimeout(timer);
    if (!complete) {
      controller.abort();
      cancel(reader);
    }
    try { reader?.releaseLock(); } catch { /* A failed transport must not replace the safe error. */ }
  }
}
