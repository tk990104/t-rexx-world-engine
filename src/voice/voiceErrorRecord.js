const SOURCES = new Set(['ICE candidate', 'ICE connection', 'Realtime connection',
  'Realtime API', 'Realtime response failed', 'Realtime data channel',
  'Realtime data channel closed', 'WebRTC connection', 'WebRTC connection lost']);
const MESSAGES = Object.freeze({
  NotAllowedError: 'Microphone access was denied. Check browser permissions before trying again.',
  NotFoundError: 'No microphone was found. Connect an input device and try again.',
  NotReadableError: 'The microphone is unavailable or in use. Check the device and try again.',
  AbortError: 'The voice request was interrupted. Try again when ready.',
  NetworkError: 'The voice connection failed. Check network access and try again.',
  invalid_api_key: 'Voice authentication failed. Check the server API-key configuration.',
  insufficient_quota: 'Voice provider quota is unavailable. Check the provider account.',
  rate_limit_exceeded: 'The voice provider is busy or rate-limited. Wait before retrying.',
  model_not_found: 'The configured voice model is unavailable. Check server configuration.',
  server_error: 'The voice provider could not complete the request. Try again later.',
  context_length_exceeded: 'The voice session reached its context limit. Start a new session.',
});
const STATES = {
  connectionState: new Set(['new', 'connecting', 'connected', 'disconnected', 'failed', 'closed']),
  iceConnectionState: new Set(['new', 'checking', 'connected', 'completed', 'disconnected', 'failed', 'closed']),
  dataChannelState: new Set(['connecting', 'open', 'closing', 'closed']),
};

/** Fixed categories only: raw provider messages, URLs, IDs and extra fields are never retained. */
export function createVoiceErrorRecord(source, error, extra = {}) {
  const rtcError = error?.error || error;
  const candidates = [rtcError?.name, rtcError?.code, extra?.code];
  const code = candidates.find(value => typeof value === 'string' && Object.hasOwn(MESSAGES, value)) || 'unknown';
  const record = {
    timestamp: new Date().toISOString(),
    source: SOURCES.has(source) ? source : 'Voice',
    code,
    message: MESSAGES[code] || 'Voice could not complete the request. Check microphone permission, network access and server configuration.',
  };
  for (const [key, allowed] of Object.entries(STATES)) {
    if (allowed.has(extra?.[key])) record[key] = extra[key];
  }
  return Object.freeze(record);
}
