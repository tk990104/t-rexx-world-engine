import assert from 'node:assert/strict';
import test from 'node:test';
import { ShareLinkManager } from '../../sharelink.js';
import { eventFromDraft } from './workspaceController.js';
import { createSharedView, encodeSharedView, decodeSharedView, createSharedViewUrl, readSharedViewHash } from './shareView.js';

const event = eventFromDraft({ title: 'São Paulo 🪐 <script>not code</script>', sport: 'Football', competition: 'Demo',
  home: 'Home', away: 'Away', localDate: '2026-11-01', localTime: '01:30', timeZone: 'America/New_York',
  utcStart: '2026-11-01T06:30:00.000Z', venueName: 'Test venue', latitude: 40.7128, longitude: -74.006,
  source: { kind: 'provider', provider: 'thesportsdb', sourceEventId: '90001', retrievedAt: '2026-09-10T00:00:00.000Z' },
  scheduleReviewed: true,
}, () => 'shared-source');
const snapshot = createSharedView(event, { houseSystem: 'equal', offsetMinutes: -60 });
const base = 'http://localhost:5173/#v=2&lat=40.7128&lon=-74.006&alt=8000&heading=12&pitch=-42&roll=0&map=osm&l=&cr=1';
const rawEncode = (value) => btoa(JSON.stringify(value)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');

test('shared inputs round-trip deterministically with Unicode, provenance and DST choice', () => {
  const encoded = encodeSharedView(snapshot);
  assert.match(encoded, /^[\w-]+$/);
  assert.deepEqual(decodeSharedView(encoded), snapshot);
  assert.equal(encodeSharedView(decodeSharedView(encoded)), encoded);
  assert.equal(snapshot.event.utcStart, '2026-11-01T06:30:00.000Z');
});

test('shared URLs preserve world state, omit query credentials and do not mutate the source', () => {
  const source = new URL(base); source.search = '?token=do-not-share'; source.username = 'private'; source.password = 'secret';
  const shared = new URL(createSharedViewUrl(source.href, snapshot));
  assert.equal(shared.search, ''); assert.equal(shared.username, ''); assert.equal(shared.password, '');
  const original = new URLSearchParams(source.hash.slice(1));
  const params = new URLSearchParams(shared.hash.slice(1));
  for (const [key, value] of original) assert.equal(params.get(key), value);
  assert.equal(original.has('ae'), false);
  assert.deepEqual(readSharedViewHash(shared.hash), { status: 'ready', snapshot });
  assert.throws(() => createSharedViewUrl('javascript:alert(1)', snapshot), /web address/);
});

test('payload allowlist discards unrelated fields rather than sharing hidden metadata', () => {
  const clean = decodeSharedView(encodeSharedView({ ...snapshot, apiKey: 'secret', chart: 'untrusted',
    event: { ...event, apiKey: 'secret', venue: { ...event.venue, hiddenNotes: 'secret' } } }));
  assert.equal(JSON.stringify(clean).includes('secret'), false);
});

test('unknown versions, invalid offsets, unsupported houses and malformed coordinates fail closed', () => {
  for (const change of [{ version: 2 }, { calculationVersion: 2 }, { engineVersion: '0.0.0' },
    { offsetMinutes: 361 }, { offsetMinutes: '15' }, { offsetMinutes: 1.5 }, { houseSystem: 'placidus' },
    { event: { ...event, venue: { ...event.venue, latitude: '' } } },
    { event: { ...event, venue: { ...event.venue, latitude: 91 } } },
    { event: { ...event, utcStart: '2026-11-01T08:00:00Z' } },
  ]) assert.throws(() => encodeSharedView({ ...snapshot, ...change }));
});

test('damaged, oversized and duplicate payloads are rejected without throwing at startup', () => {
  for (const token of ['', 'not+base64', 'a', 'a'.repeat(8193), rawEncode({ version: 99 })]) {
    assert.equal(readSharedViewHash(`${new URL(base).hash}&ae=${token}`).status, 'invalid');
  }
  const token = encodeSharedView(snapshot);
  assert.equal(readSharedViewHash(`${new URL(base).hash}&ae=${token}&ae=${token}`).status, 'invalid');
  assert.equal(readSharedViewHash(`#ae=${token}`).status, 'invalid');
  assert.deepEqual(readSharedViewHash('#lat=1&lon=2'), { status: 'absent' });
  assert.throws(() => encodeSharedView({ ...snapshot, event: { ...event, title: 'x'.repeat(513) } }), /too long/);
});

test('world snapshot public seam is side-effect free and normal links exclude AstroEye data', () => {
  const previousWindow = globalThis.window;
  globalThis.window = { location: { href: createSharedViewUrl(base, snapshot) } };
  try {
    const manager = new ShareLinkManager({ camera: {
      changed: { addEventListener() {} }, positionCartographic: { latitude: 0, longitude: 0, height: 8000 },
      heading: 0, pitch: -Math.PI / 2, roll: 0,
    } });
    const before = window.location.href;
    const result = new URL(manager.createLink({ nowMs: 100000 }));
    assert.equal(window.location.href, before);
    assert.equal(new URLSearchParams(result.hash.slice(1)).has('ae'), false);
    assert.equal(new URLSearchParams(result.hash.slice(1)).get('at'), '100');
    manager.destroy();
    assert.equal(manager.createLink(), null);
  } finally { globalThis.window = previousWindow; }
});
