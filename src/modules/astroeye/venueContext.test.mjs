import assert from 'node:assert/strict';
import test from 'node:test';
import * as Cesium from 'cesium';
import { createVenueContextModel } from './venueContext.js';
import { installAstroEyeVenueInteraction } from './venueInteraction.js';
import { ASTROEYE_EVENT_ENTITY_ID } from './worldPresenter.js';
import { isOwnedByOtherLayer } from '../../data/pickRegistry.js';
import { eventFromDraft } from './workspaceController.js';
import { calculateTimePreview } from './timeExplorer.js';

const event = eventFromDraft({ title: '<img src=x onerror=alert(1)> 🪐', home: 'Home', away: 'Away', sport: 'Demo', competition: 'Demo',
  localDate: '2026-11-01', localTime: '01:30', timeZone: 'America/New_York', utcStart: '2026-11-01T06:30:00.000Z',
  venueName: '<b>Demo venue</b>', latitude: 40.7128, longitude: -74.006 }, () => 'context-event');
const chart = calculateTimePreview(event, -60, { houseSystem: 'equal' });

test('venue context separates original DST occurrence from chart preview and preserves source text', () => {
  const model = createVenueContextModel({ event, chart, offsetMinutes: -60, isShared: true });
  assert.match(model.eventTime, /06:30:00 UTC/);
  assert.match(model.chartTime, /05:30:00 UTC/);
  assert.equal(model.coordinates, '40.71280, -74.00600');
  assert.match(model.mode, /60 minutes/);
  assert.match(model.method, /equal houses/);
  assert.equal(model.title, event.title);
  assert.equal(model.venue, event.venue.name);
  assert.match(model.storage, /Unsaved/);
  assert.match(model.summary, /1 selected venue · 10 bodies/);
  assert.match(model.source, /Manual entry/);
  assert.equal(createVenueContextModel(null), null);
});

test('provider context identifies provenance without constructing a link or claiming verification', () => {
  const model = createVenueContextModel({ event: { ...event, source: { kind: 'provider', provider: 'thesportsdb',
    sourceEventId: 'demo-id', retrievedAt: '2026-09-10T00:00:00.000Z' } }, chart, isShared: false });
  assert.match(model.source, /thesportsdb · event demo-id · retrieved 2026-09-10 00:00:00 UTC/);
  assert.equal(model.storage, 'Saved event selected');
});

function interaction() {
  const callbacks = new Map();
  let selected = true, permitted = true, opened = 0, destroyed = 0, picks = 0;
  let hit = { id: { id: ASTROEYE_EVENT_ENTITY_ID } };
  const cleanup = installAstroEyeVenueInteraction({
    viewer: { scene: { canvas: {}, pick() { picks++; return hit; } } },
    hasSelection: () => selected, canInteract: () => permitted, onOpen: () => { opened++; },
    createHandler: () => ({ setInputAction: (callback, type) => callbacks.set(type, callback), destroy: () => { destroyed++; } }),
  });
  const fire = (type, event = { position: { x: 10, y: 10 } }) => callbacks.get(Cesium.ScreenSpaceEventType[type])(event);
  return { cleanup, fire, get opened() { return opened; }, get destroyed() { return destroyed; }, get picks() { return picks; },
    select: (value) => { selected = value; }, allow: (value) => { permitted = value; }, hit: (value) => { hit = value; } };
}
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };

test('venue picks are registered with other layers and only the owned topmost pick opens context', async () => {
  const state = interaction();
  try {
    assert.equal(isOwnedByOtherLayer('flights', ASTROEYE_EVENT_ENTITY_ID), true);
    state.fire('LEFT_CLICK'); await flush(); assert.equal(state.opened, 1);
    state.hit({ id: 'flight-other' }); state.fire('LEFT_CLICK'); await flush(); assert.equal(state.opened, 1);
    state.hit(null); state.fire('LEFT_CLICK'); await flush(); assert.equal(state.opened, 1);
    state.select(false);
    assert.equal(isOwnedByOtherLayer('flights', ASTROEYE_EVENT_ENTITY_ID), false);
    state.fire('LEFT_CLICK'); assert.equal(state.picks, 3);
  } finally { state.cleanup(); }
  assert.equal(isOwnedByOtherLayer('flights', ASTROEYE_EVENT_ENTITY_ID), false);
  state.cleanup(); assert.equal(state.destroyed, 1);
});

test('drags, playback guards and disposal block picking or queued context opening', async () => {
  const state = interaction();
  try {
    state.fire('LEFT_DOWN');
    state.fire('MOUSE_MOVE', { endPosition: { x: 50, y: 10 } });
    state.fire('LEFT_UP'); state.fire('LEFT_CLICK'); await flush();
    assert.equal(state.picks, 0);
    state.allow(false); state.fire('LEFT_CLICK'); assert.equal(state.picks, 0);
    state.allow(true); state.fire('LEFT_CLICK');
    state.cleanup(); await flush();
    assert.equal(state.opened, 0, 'dispose wins over queued callback');
  } finally { state.cleanup(); }
});
