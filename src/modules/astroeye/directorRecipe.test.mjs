import assert from 'node:assert/strict';
import test from 'node:test';
import { eventFromDraft } from './workspaceController.js';
import { createSharedView } from './shareView.js';
import { createAstroEyeTour, normalizeAstroEyeSceneView } from './directorRecipe.js';
import { normalizeSceneModules } from '../../scenes/moduleState.js';

const event = eventFromDraft({ title: 'Tour <demo> 🪐', sport: 'Football', competition: 'Demo', home: 'Home', away: 'Away',
  localDate: '2026-11-01', localTime: '01:30', timeZone: 'America/New_York', utcStart: '2026-11-01T06:30:00.000Z',
  venueName: 'Demo venue', latitude: 40.7128, longitude: -74.006 }, () => 'tour-event');
const view = createSharedView(event, { houseSystem: 'equal', offsetMinutes: -60 });

test('event tour is deterministic, camera-only and preserves the DST occurrence and preview method', () => {
  const scene = createAstroEyeTour(view, { id: 'tour-1' });
  assert.deepEqual(scene, createAstroEyeTour(view, { id: 'tour-1' }));
  assert.equal(scene.shots.length, 3);
  assert.deepEqual(scene.shots.map((shot) => shot.camera.alt), [18000000, 250000, 12000]);
  assert.equal(scene.shots.reduce((time, shot) => time + shot.durationSec + shot.holdSec, 0), 18);
  for (const shot of scene.shots) {
    assert.deepEqual(shot.layers, {});
    assert.deepEqual(shot.modules.astroeye, view);
    assert.match(shot.title, /05:30:00 UTC/);
    assert.equal(shot.camera.lat, event.venue.latitude);
    assert.equal(shot.camera.lon, event.venue.longitude);
  }
  scene.shots[0].modules.astroeye.event.title = 'mutated';
  assert.equal(scene.shots[1].modules.astroeye.event.title, event.title);
  assert.equal(view.event.title, event.title);
});

test('tour payloads discard unrelated data and event sky without changing input', () => {
  const input = { ...view, skyEnabled: true, hiddenNotes: 'private' };
  const normalized = normalizeAstroEyeSceneView(input);
  assert.deepEqual(normalized, view);
  assert.equal(input.skyEnabled, true);
  assert.equal(JSON.stringify(createAstroEyeTour(input)).includes('private'), false);
});

test('invalid or future calculation inputs cannot generate a tour', () => {
  for (const change of [{ version: 99 }, { engineVersion: 'future' }, { offsetMinutes: 361 }, { houseSystem: 'placidus' }]) {
    assert.throws(() => createAstroEyeTour({ ...view, ...change }));
  }
});

test('scene envelopes preserve future modules while bounding size and rejecting unsafe IDs', () => {
  const source = { 'sound-radar': { version: 2, station: 'example' } };
  assert.deepEqual(normalizeSceneModules(source), source);
  assert.notEqual(normalizeSceneModules(source)['sound-radar'], source['sound-radar']);
  for (const raw of [null, [], { astroeye: null }, { astroeye: { version: '1' } },
    JSON.parse('{"__proto__":{"version":1}}'), { constructor: { version: 1 } },
    { astroeye: { version: 1, data: 'x'.repeat(32768) } }]) assert.throws(() => normalizeSceneModules(raw));
});
