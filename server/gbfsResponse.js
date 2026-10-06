import { Buffer } from 'node:buffer';

export const GBFS_MAX_BODY_BYTES = 5 * 1024 * 1024;
export const GBFS_PROXY_TIMEOUT_MS = 12_000;

export class GbfsResponseError extends Error {
  constructor(code) { super(code); this.code = code; }
}

function cancel(body) {
  try { void body?.cancel().catch(() => {}); } catch { /* Do not await cleanup. */ }
}

/** GBFS-specific budget: one deadline covers headers and actual streamed bytes. */
export async function fetchGbfsText(url, { fetchImpl = globalThis.fetch,
  timeoutMs = GBFS_PROXY_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  let reader, timer, complete = false;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new GbfsResponseError('timeout'));
    }, timeoutMs);
  });
  const operation = async () => {
    const response = await fetchImpl(url, {
      method: 'GET', redirect: 'error', signal: controller.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'gods-eye-view-gbfs-proxy/1.0' },
    });
    if (controller.signal.aborted) { cancel(response.body); throw new GbfsResponseError('timeout'); }
    if (!response.ok) { cancel(response.body); return { response, text: null }; }
    reader = response.body?.getReader();
    if (Number(response.headers.get('content-length')) > GBFS_MAX_BODY_BYTES) {
      throw new GbfsResponseError('size');
    }
    if (!reader) { complete = true; return { response, text: '' }; }
    const buffer = Buffer.alloc(GBFS_MAX_BODY_BYTES);
    let bytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (controller.signal.aborted) throw new GbfsResponseError('timeout');
      if (done) { complete = true; break; }
      if (bytes + value.byteLength > GBFS_MAX_BODY_BYTES) throw new GbfsResponseError('size');
      buffer.set(value, bytes);
      bytes += value.byteLength;
    }
    return { response, text: new TextDecoder().decode(buffer.subarray(0, bytes)) };
  };
  try { return await Promise.race([operation(), deadline]); }
  finally {
    clearTimeout(timer);
    if (!complete) { controller.abort(); cancel(reader); }
    try { reader?.releaseLock(); } catch { /* Cleanup cannot replace the result. */ }
  }
}
