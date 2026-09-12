import assert from 'node:assert/strict';
import test from 'node:test';
import * as Cesium from 'cesium';
import { EventBus } from '../../core/eventBus.js';
import { createSavedEventLayer, savedEventEntityId } from './savedEventLayer.js';
import { installAstroEyeVenueInteraction } from './venueInteraction.js';
import { isOwnedByOtherLayer } from '../../data/pickRegistry.js';

const event = (id) => ({ id: String(id), title: `<b>Event ${id}</b>`, utcStart: '2026-09-12T12:00:00Z',
  venue: { latitude: 40, longitude: -74 }, scheduledLocal: { date: '2026-09-12', time: '12:00:00', timeZone: 'UTC' } });
function harness(read = async () => [event('a'), event('b')]) {
  const eventBus = new EventBus(), entities = new Cesium.EntityCollection();
  entities.add({ id: 'unrelated' });
  let selection = null, reads = 0;
  const layer = createSavedEventLayer({ viewer: { entities, scene: { requestRender() {} } }, eventBus,
    listEvents: () => { reads++; return read(); }, getSelection: () => selection });
  return { layer, entities, eventBus, get reads() { return reads; }, select: (value) => { selection = value; eventBus.emit('astroeye:event-selected'); } };
}

test('saved markers are opt-in, bounded, deterministic and leave other entities alone', async () => {
  const h = harness(async () => Array.from({ length: 103 }, (_, i) => event(String(i).padStart(3, '0'))).reverse());
  try {
    assert.equal(h.reads, 0);
    await h.layer.setEnabled(true);
    assert.equal(h.layer.state().shown, 100);
    assert.equal(h.layer.state().total, 103);
    assert.equal(h.layer.eventIdForEntity(savedEventEntityId('000')), '000');
    assert.equal(h.layer.eventIdForEntity(savedEventEntityId('102')), null);
    assert.match(h.entities.getById(savedEventEntityId('000')).label.text.getValue(), /<b>Event 000<\/b>/);
    await h.layer.setEnabled(false);
    assert.deepEqual(h.entities.values.map((entity) => entity.id), ['unrelated']);
  } finally { h.layer.destroy(); }
});

test('selected local event is excluded; shared ID collisions do not hide local records', async () => {
  const h = harness();
  try {
    await h.layer.setEnabled(true);
    h.select({ event: event('a'), isShared: false });
    assert.equal(h.layer.state().shown, 1);
    assert.equal(h.layer.eventIdForEntity(savedEventEntityId('a')), null);
    h.select({ event: event('a'), isShared: true });
    assert.equal(h.layer.state().shown, 2);
    assert.equal(h.reads, 1, 'selection needs no record reload');
    h.layer.setSuspended(true);
    assert.equal(h.layer.state().shown, 0);
    h.layer.setSuspended(false);
    assert.equal(h.layer.state().shown, 2);
  } finally { h.layer.destroy(); }
});

test('frame points contain only displayed matches plus a matching selected saved event', async () => {
  const h = harness();
  try {
    assert.deepEqual(h.layer.framePoints(), []);
    await h.layer.setEnabled(true);
    h.select({ event: event('a'), isShared: false });
    assert.equal(h.layer.state().shown, 1);
    assert.equal(h.layer.state().frameable, 2);
    h.layer.setFilters({ query: 'Event a' });
    assert.equal(h.layer.state().shown, 0);
    assert.equal(h.layer.framePoints().length, 1, 'selected-only match can still be framed');
    h.layer.setFilters({ query: 'Event b' });
    assert.equal(h.layer.framePoints().length, 1, 'out-of-filter selection is not framed');
    const copy = h.layer.framePoints(); copy[0].latitude = 999;
    assert.equal(h.layer.framePoints()[0].latitude, 40);
    h.layer.setSuspended(true); assert.deepEqual(h.layer.framePoints(), []);
    h.layer.setSuspended(false);
    await h.layer.setEnabled(false); assert.deepEqual(h.layer.framePoints(), []);
  } finally { h.layer.destroy(); }
});

test('filters apply before the marker cap and do not reread records or remove the selected marker', async () => {
  const h = harness(async () => Array.from({ length: 103 }, (_, i) => event(String(i).padStart(3, '0'))));
  h.entities.add({ id: 't-rexx-astroeye-selected-event' });
  try {
    await h.layer.setEnabled(true);
    h.layer.setFilters({ query: 'Event 102' });
    assert.equal(h.layer.state().matched, 1);
    assert.equal(h.layer.state().shown, 1);
    assert.equal(h.layer.eventIdForEntity(savedEventEntityId('102')), '102');
    assert.equal(h.reads, 1);
    assert.throws(() => h.layer.setFilters({ dateFrom: '2026-09-13', dateTo: '2026-09-12' }));
    assert.equal(h.layer.state().shown, 1);
    h.layer.setFilters({ query: 'No matches' });
    assert.equal(h.layer.state().shown, 0);
    assert.ok(h.entities.getById('t-rexx-astroeye-selected-event'));
    assert.ok(h.entities.getById('unrelated'));
    h.layer.setFilters({});
    assert.equal(h.layer.state().shown, 100);
  } finally { h.layer.destroy(); }
});

test('pending reads, hide/show and Director resume all retain the latest filters', async () => {
  let release;
  const h = harness(() => new Promise((resolve) => { release = resolve; }));
  try {
    const first = h.layer.setEnabled(true);
    h.layer.setFilters({ query: 'Event b' });
    release([event('a'), event('b')]); await first;
    assert.equal(h.layer.eventIdForEntity(savedEventEntityId('a')), null);
    assert.equal(h.layer.eventIdForEntity(savedEventEntityId('b')), 'b');
    h.layer.setSuspended(true); h.layer.setSuspended(false);
    assert.equal(h.layer.state().shown, 1);
    await h.layer.setEnabled(false);
    const second = h.layer.setEnabled(true);
    release([event('a'), event('b')]); await second;
    assert.equal(h.layer.state().shown, 1);
  } finally { h.layer.destroy(); }
});

test('oldest/newest order controls the marker cap without new reads or changing selection', async () => {
  const rows = Array.from({ length: 103 }, (_, i) => ({ ...event(String(i).padStart(3, '0')),
    utcStart: new Date(Date.UTC(2026, 0, 1) + i * 86400000).toISOString() }));
  const h = harness(async () => rows);
  try {
    await h.layer.setEnabled(true);
    assert.equal(h.layer.eventIdForEntity(savedEventEntityId('000')), null);
    assert.equal(h.layer.eventIdForEntity(savedEventEntityId('102')), '102');
    h.layer.setFilters({ sort: 'oldest' });
    assert.equal(h.layer.eventIdForEntity(savedEventEntityId('000')), '000');
    assert.equal(h.layer.eventIdForEntity(savedEventEntityId('102')), null);
    assert.equal(h.layer.state().shown, 100);
    assert.equal(h.reads, 1);
    assert.throws(() => h.layer.setFilters({ sort: 'bad' }));
    assert.equal(h.layer.eventIdForEntity(savedEventEntityId('000')), '000');
  } finally { h.layer.destroy(); }
});

test('late reads cannot resurrect a hidden or destroyed layer', async () => {
  const releases = [];
  const h = harness(() => new Promise((resolve) => releases.push(resolve)));
  const first = h.layer.setEnabled(true);
  await h.layer.setEnabled(false);
  releases.shift()([event('a')]); await first;
  assert.equal(h.layer.state().shown, 0);
  const second = h.layer.setEnabled(true);
  h.layer.destroy(); releases.shift()([event('b')]); await second;
  assert.deepEqual(h.entities.values.map((entity) => entity.id), ['unrelated']);
  h.eventBus.emit('astroeye:event-saved');
  assert.equal(h.reads, 2);
});

test('save, import and delete notifications refresh only an enabled collection', async () => {
  let records = [event('a')];
  const h = harness(async () => records);
  try {
    h.eventBus.emit('astroeye:event-saved');
    assert.equal(h.reads, 0);
    await h.layer.setEnabled(true);
    for (const type of ['astroeye:event-saved', 'astroeye:records-imported', 'astroeye:event-deleted']) {
      records = type.endsWith('deleted') ? [] : [event(type)];
      h.eventBus.emit(type); await Promise.resolve();
      assert.equal(h.layer.state().shown, records.length);
      if (records.length) assert.equal(h.layer.eventIdForEntity(savedEventEntityId(records[0].id)), records[0].id);
    }
  } finally { h.layer.destroy(); }
});

test('latest refresh wins and a read failure clears stale markers with a visible error', async () => {
  let read = async () => [event('a')];
  const h = harness(() => read());
  try {
    await h.layer.setEnabled(true);
    let release;
    read = () => new Promise((resolve) => { release = resolve; });
    const stale = h.layer.refresh();
    read = async () => [event('b')];
    await h.layer.refresh(); release([event('a')]); await stale;
    assert.equal(h.layer.eventIdForEntity(savedEventEntityId('b')), 'b');
    assert.equal(h.layer.eventIdForEntity(savedEventEntityId('a')), null);
    read = async () => { throw new Error('Private storage internals'); };
    await h.layer.refresh();
    assert.equal(h.layer.state().shown, 0);
    assert.match(h.layer.state().error, /could not be read/);
    assert.doesNotMatch(h.layer.state().error, /Private/);
  } finally { h.layer.destroy(); }
});

test('saved marker picking works without a selection and rechecks ownership before queued opens', async () => {
  const callbacks = new Map(), opened = [];
  let visible = true, allowed = true;
  const id = savedEventEntityId('a');
  const cleanup = installAstroEyeVenueInteraction({ viewer: { scene: { canvas: {}, pick: () => ({ id }) } },
    hasSelection: () => false, onOpen: () => assert.fail('Not the selected marker'), canInteract: () => allowed,
    savedEventIdForEntity: (pickId) => visible && pickId === id ? 'a' : null, onSavedEvent: (eventId) => opened.push(eventId),
    createHandler: () => ({ setInputAction: (fn, type) => callbacks.set(type, fn), destroy() {} }) });
  const click = () => callbacks.get(Cesium.ScreenSpaceEventType.LEFT_CLICK)({ position: { x: 1, y: 1 } });
  try {
    assert.equal(isOwnedByOtherLayer('flights', id), true);
    click(); await Promise.resolve(); assert.deepEqual(opened, ['a']);
    click(); visible = false; await Promise.resolve(); assert.equal(opened.length, 1);
    visible = true; allowed = false; click(); await Promise.resolve(); assert.equal(opened.length, 1);
    allowed = true; click(); cleanup(); await Promise.resolve(); assert.equal(opened.length, 1);
  } finally { cleanup(); }
});
