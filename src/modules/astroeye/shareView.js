import { normalizeEvent } from '../../domain/events/eventSchema.js';
import { ASTRONOMY_ENGINE_VERSION } from './calculation/astronomyEngineProvider.js';
import { HOUSE_SYSTEMS } from './calculation/houses.js';
import { TIME_EXPLORER_LIMIT_MINUTES } from './timeExplorer.js';

export const ASTROEYE_SHARE_PARAM = 'ae';
export const ASTROEYE_SHARE_MAX_LENGTH = 8192;

/** Explicit allowlist: links contain calculation inputs, never executable charts or credentials. */
export function normalizeSharedView(input) {
  if (!input || input.version !== 1 || input.calculationVersion !== 1) throw new Error('Unsupported AstroEye link version.');
  if (input.engineVersion !== ASTRONOMY_ENGINE_VERSION) throw new Error('This link requires a different calculation engine version.');
  if (!HOUSE_SYSTEMS.includes(input.houseSystem)) throw new Error('Unsupported shared house system.');
  if (!Number.isInteger(input.offsetMinutes) || Math.abs(input.offsetMinutes) > TIME_EXPLORER_LIMIT_MINUTES) {
    throw new Error('Shared preview time is outside the supported range.');
  }
  for (const key of ['latitude', 'longitude']) {
    if (typeof input.event?.venue?.[key] !== 'number') throw new Error('Shared venue coordinates must be numbers.');
  }
  const event = normalizeEvent(input.event);
  function checkStrings(value) {
    if (typeof value === 'string' && value.length > 512) throw new Error('Shared event text is too long. Use a records export instead.');
    if (value && typeof value === 'object') Object.values(value).forEach(checkStrings);
  }
  checkStrings(event);
  return Object.freeze({ version: 1, calculationVersion: 1, engineVersion: ASTRONOMY_ENGINE_VERSION,
    event, houseSystem: input.houseSystem, offsetMinutes: input.offsetMinutes });
}

export function createSharedView(event, { houseSystem = 'whole-sign', offsetMinutes = 0 } = {}) {
  return normalizeSharedView({ version: 1, calculationVersion: 1,
    engineVersion: ASTRONOMY_ENGINE_VERSION, event, houseSystem, offsetMinutes });
}

export function encodeSharedView(input) {
  const bytes = new TextEncoder().encode(JSON.stringify(normalizeSharedView(input)));
  const encoded = btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
  if (encoded.length > ASTROEYE_SHARE_MAX_LENGTH) throw new Error('This event is too large for a view link. Use a records export instead.');
  return encoded;
}

export function decodeSharedView(encoded) {
  if (typeof encoded !== 'string' || !encoded.length || encoded.length > ASTROEYE_SHARE_MAX_LENGTH || !/^[\w-]+$/.test(encoded)) {
    throw new Error('Invalid or oversized AstroEye link.');
  }
  let parsed;
  try {
    const bytes = Uint8Array.from(atob(encoded.replaceAll('-', '+').replaceAll('_', '/')), (char) => char.charCodeAt(0));
    parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch { throw new Error('The AstroEye link is damaged or incomplete.'); }
  return normalizeSharedView(parsed);
}

/** Snapshot links are opt-in; normal camera/address updates must not include event data. */
export function createSharedViewUrl(baseUrl, snapshot) {
  const url = new URL(baseUrl);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('A web address is required to share a view.');
  url.username = ''; url.password = ''; url.search = '';
  const params = new URLSearchParams(url.hash.slice(1));
  params.set(ASTROEYE_SHARE_PARAM, encodeSharedView(snapshot));
  url.hash = params.toString();
  if (url.href.length > 16000) throw new Error('The combined view link is too long. Use a records export instead.');
  return url.href;
}

/** Capture once at startup, before the camera's ordinary URL updates remove ae. */
export function readSharedViewHash(hash) {
  const params = new URLSearchParams(String(hash).replace(/^#/, ''));
  if (!params.has(ASTROEYE_SHARE_PARAM)) return { status: 'absent' };
  try {
    if (params.get('v') !== '2') throw new Error('The shared world view version is unsupported.');
    for (const [key, min, max] of [['lat', -90, 90], ['lon', -180, 180], ['alt', 0, 1e10], ['heading', -360, 360], ['pitch', -90, 90], ['roll', -360, 360]]) {
      const raw = params.get(key);
      const value = Number(raw);
      if (!raw?.trim() || params.getAll(key).length !== 1 || !Number.isFinite(value) || value < min || value > max) {
        throw new Error('The shared camera view is invalid or incomplete.');
      }
    }
    if (params.getAll(ASTROEYE_SHARE_PARAM).length !== 1) throw new Error('The AstroEye link contains duplicate event payloads.');
    return { status: 'ready', snapshot: decodeSharedView(params.get(ASTROEYE_SHARE_PARAM)) };
  } catch (error) {
    return { status: 'invalid', message: `AstroEye view not restored: ${error.message}` };
  }
}
