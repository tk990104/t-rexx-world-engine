import { Buffer } from 'node:buffer';

export const VOICE_REQUEST_TIMEOUT_MS = 10_000;

/** Fixed memory and one whole-read deadline; reject and close incomplete uploads. */
export function readVoiceRequestBody(req, maxBytes, { timeoutMs = VOICE_REQUEST_TIMEOUT_MS } = {}) {
  if (!Number.isInteger(maxBytes) || maxBytes < 1 || maxBytes > 64 * 1024) {
    return Promise.reject(new Error('Invalid voice request limit'));
  }
  return new Promise((resolve, reject) => {
    const buffer = Buffer.alloc(maxBytes);
    let bytes = 0;
    let settled = false;
    let timer;
    const cleanup = () => {
      clearTimeout(timer);
      req.removeListener('data', onData);
      req.removeListener('end', onEnd);
      req.removeListener('error', onError);
      req.removeListener('aborted', onAbort);
      req.removeListener('close', onClose);
    };
    const fail = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error('Voice request body unavailable or exceeds limits'));
      // No raw error argument: do not introduce an unhandled stream error.
      req.destroy();
    };
    const onData = chunk => {
      if (settled) return;
      if (!(chunk instanceof Uint8Array) || bytes + chunk.byteLength > maxBytes) return fail();
      buffer.set(chunk, bytes);
      bytes += chunk.byteLength;
    };
    const onEnd = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(buffer.toString('utf8', 0, bytes));
    };
    const onError = () => fail();
    const onAbort = () => fail();
    const onClose = () => fail();
    if (req.aborted || req.destroyed || req.readableEnded
      || Number(req.headers?.['content-length']) > maxBytes) return fail();
    timer = setTimeout(fail, timeoutMs);
    req.on('data', onData);
    req.on('end', onEnd);
    req.on('error', onError);
    req.on('aborted', onAbort);
    req.on('close', onClose);
  });
}
