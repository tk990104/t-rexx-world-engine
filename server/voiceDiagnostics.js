import fs from 'node:fs';
import path from 'node:path';
import { voiceDiagnosticRecord } from '../src/voice/voiceDiagnosticRecord.js';

export const VOICE_DIAGNOSTIC_MAX_BYTES = 256 * 1024;
export const VOICE_DIAGNOSTIC_REQUEST_BYTES = 4096;
export const VOICE_DIAGNOSTIC_FILENAME = 'voice-diagnostics-v1.jsonl';

/** Append metadata only; stop at the cap, never rotate/delete previous logs. */
export function createVoiceDiagnosticSink(directory, { now = () => new Date() } = {}) {
  return (record) => {
    const safe = voiceDiagnosticRecord(record);
    if (!safe) throw new Error('Invalid diagnostic');
    const line = `${JSON.stringify({ loggedAt: now().toISOString(), ...safe })}\n`;
    fs.mkdirSync(directory, { recursive: true });
    if (fs.lstatSync(directory).isSymbolicLink()) throw new Error('Invalid log directory');
    const file = path.join(directory, VOICE_DIAGNOSTIC_FILENAME);
    let size = 0;
    try {
      const info = fs.lstatSync(file);
      if (!info.isFile() || info.isSymbolicLink()) throw new Error('Invalid log file');
      size = info.size;
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (size + Buffer.byteLength(line) > VOICE_DIAGNOSTIC_MAX_BYTES) return false;
    // Synchronous size-check/append keeps requests in this process serialized.
    fs.appendFileSync(file, line, { encoding: 'utf8', mode: 0o600 });
    return true;
  };
}

export function createVoiceDiagnosticHandler({ enabled, readBody, append }) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const fail = (status, error) => {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error }));
    };
    if (req.method !== 'POST') return fail(405, 'Method not allowed');
    // Disabled requests never read the body, touch the filesystem or enable logging.
    if (!enabled()) return fail(403, 'Voice diagnostics are disabled');
    try {
      const record = voiceDiagnosticRecord(JSON.parse(await readBody(req, VOICE_DIAGNOSTIC_REQUEST_BYTES)));
      if (!record) return fail(400, 'Invalid voice diagnostic');
      if (!append(record)) return fail(507, 'Voice diagnostic log is full');
      res.statusCode = 204;
      res.end();
    } catch {
      fail(400, 'Unable to record voice diagnostic');
    }
  };
}
