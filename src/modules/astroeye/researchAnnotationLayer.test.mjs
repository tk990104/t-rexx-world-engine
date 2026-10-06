import test from 'node:test';
import assert from 'node:assert/strict';
import * as Cesium from 'cesium';
import { EventBus } from '../../core/eventBus.js';
import { isOwnedByOtherLayer } from '../../data/pickRegistry.js';
import { createResearchAnnotationLayer, researchNoteEntityId } from './researchAnnotationLayer.js';
import { RESEARCH_ANNOTATIONS_ID } from './researchAnnotations.js';

const entry = (id) => ({ id: `astroeye-note:${id}`, schemaVersion: 1, eventId: 'private-source',
  latitude: 40, longitude: -75, chartTimeUtc: '2026-09-14T12:15:00.000Z', note: 'PRIVATE NOTE TEXT' });
const collection = (ids = ['a', 'b']) => ({ id: RESEARCH_ANNOTATIONS_ID, kind: 'astroeye-event-annotations', schemaVersion: 1, annotations: ids.map(entry) });
function harness(read = async () => collection()) {
  const entities = new Cesium.EntityCollection(), eventBus = new EventBus();
  const unrelated = entities.add({ id: 'unrelated', name: 'Keep' });
  let reads = 0, allowed = true;
  const layer = createResearchAnnotationLayer({ viewer: { entities, scene: { requestRender() {} } }, eventBus,
    loadAnnotations: () => { reads++; return read(); }, canDisplay: () => allowed });
  return { layer, entities, eventBus, unrelated, get reads() { return reads; }, setAllowed: (value) => { allowed = value; } };
}

test('note markers are explicit opt-in, read-only snapshots with no private text or source fields', async () => {
  const h = harness();
  try {
    assert.equal(h.reads, 0); assert.equal(h.layer.state().shown, 0);
    await h.layer.refresh(); h.eventBus.emit('astroeye:records-imported'); assert.equal(h.reads, 0);
    await h.layer.setEnabled(true);
    assert.equal(h.layer.state().shown, 2);
    const marker = h.entities.getById(researchNoteEntityId('astroeye-note:a'));
    const location = Cesium.Cartographic.fromCartesian(marker.position.getValue(Cesium.JulianDate.now()));
    assert.ok(Math.abs(Cesium.Math.toDegrees(location.latitude) - 40) < 1e-8);
    assert.ok(Math.abs(Cesium.Math.toDegrees(location.longitude) + 75) < 1e-8);
    assert.match(marker.label.text.getValue(), /2026-09-14T12:15:00.000Z/);
    assert.doesNotMatch(marker.label.text.getValue(), /PRIVATE|private-source/);
    assert.equal(marker.properties, undefined); assert.equal(marker.description, undefined);
    assert.equal(marker.point.disableDepthTestDistance.getValue(), 200000);
    assert.equal(marker.label.disableDepthTestDistance.getValue(), 200000);
    assert.equal(marker.label.verticalOrigin.getValue(), Cesium.VerticalOrigin.TOP);
    assert.equal(marker.label.pixelOffset.getValue().y, 12);
    assert.equal(isOwnedByOtherLayer('flights', marker.id), true);
    await h.layer.setEnabled(false);
    assert.deepEqual(h.entities.values, [h.unrelated]);
    assert.equal(isOwnedByOtherLayer('flights', marker.id), false);
  } finally { h.layer.destroy(); }
});

test('exact-coordinate notes share a deterministic count/range label without merging nearby captures or records', async () => {
  let rows = collection(['c', 'b', 'a', 'near']);
  rows.annotations[0].chartTimeUtc = '2026-09-15T12:00:00.000Z';
  rows.annotations[1].chartTimeUtc = '2026-09-13T12:00:00.000Z';
  rows.annotations[3].latitude += 0.000001;
  const before = JSON.stringify(rows), h = harness(async () => rows);
  const marker = (id) => h.entities.getById(researchNoteEntityId(`astroeye-note:${id}`));
  try {
    await h.layer.setEnabled(true);
    assert.equal(h.layer.state().shown, 4);
    assert.equal(marker('a').label.text.getValue(), '3 event notes · captured UTC\nFirst: 2026-09-13T12:00:00.000Z\nLast: 2026-09-15T12:00:00.000Z');
    for (const id of ['b', 'c']) {
      assert.equal(marker(id).label.show.getValue(), false);
      assert.equal(marker(id).label.text.getValue(), '');
      assert.ok(marker(id).point);
    }
    assert.equal(marker('near').label.show.getValue(), true);
    assert.match(marker('near').label.text.getValue(), /^Event note/);
    assert.equal(JSON.stringify(rows), before);
    rows.annotations.reverse(); await h.layer.refresh();
    assert.equal(marker('a').label.show.getValue(), true);
    rows.annotations = rows.annotations.filter(({ id }) => id !== 'astroeye-note:a');
    await h.layer.refresh();
    assert.equal(marker('a'), undefined);
    assert.equal(marker('b').label.show.getValue(), true);
    assert.match(marker('b').label.text.getValue(), /^2 event notes/);
    rows = collection(['c']); await h.layer.refresh();
    assert.equal(marker('c').label.show.getValue(), true);
    assert.equal(marker('c').label.text.getValue(), 'Event note · captured UTC\n2026-09-14T12:15:00.000Z');
  } finally { h.layer.destroy(); }
});

test('100-note maximum is enforced; oversized and future collections fail closed with no partial markers', async () => {
  let rows = collection(Array.from({ length: 100 }, (_, i) => String(i)));
  const h = harness(async () => rows);
  try {
    await h.layer.setEnabled(true); assert.equal(h.layer.state().shown, 100);
    const visibleLabels = h.entities.values.filter((entity) => entity.label?.show.getValue());
    assert.equal(visibleLabels.length, 1);
    assert.equal(visibleLabels[0].label.text.getValue(), '100 event notes · captured UTC\n2026-09-14T12:15:00.000Z');
    for (const invalid of [collection(Array.from({ length: 101 }, (_, i) => String(i))), { ...rows, schemaVersion: 99 }, collection(['a', 'a'])]) {
      rows = invalid; await h.layer.refresh();
      assert.equal(h.layer.state().shown, 0); assert.match(h.layer.state().error, /could not/);
      assert.deepEqual(h.entities.values, [h.unrelated]);
    }
  } finally { h.layer.destroy(); }
});

test('hide and destroy invalidate delayed reads without drawing or continuing subscriptions', async () => {
  const releases = [], h = harness(() => new Promise((resolve) => releases.push(resolve)));
  const first = h.layer.setEnabled(true);
  await h.layer.setEnabled(false); releases[0](collection()); await first;
  assert.equal(h.layer.state().shown, 0);
  const second = h.layer.setEnabled(true);
  h.layer.destroy(); releases[1](collection()); await second;
  h.eventBus.emit('astroeye:records-imported');
  await h.layer.setEnabled(true); assert.equal(h.reads, 2);
  assert.deepEqual(h.entities.values, [h.unrelated]);
  h.layer.destroy();
});

test('unsafe shared/playback state disables markers, invalidates in-flight reads and never auto-resumes', async () => {
  const releases = [], h = harness(() => new Promise((resolve) => releases.push(resolve)));
  try {
    h.setAllowed(false); await h.layer.setEnabled(true); assert.equal(h.reads, 0);
    h.setAllowed(true); const pending = h.layer.setEnabled(true);
    h.setAllowed(false); h.eventBus.emit('astroeye:event-selected');
    h.setAllowed(true); releases[0](collection()); await pending;
    h.eventBus.emit('astroeye:event-selected');
    assert.equal(h.layer.state().enabled, false); assert.equal(h.layer.state().shown, 0);
    const second = h.layer.setEnabled(true); releases[1](collection()); await second;
    assert.equal(h.layer.state().shown, 2);
    h.setAllowed(false); await h.layer.refresh(); assert.equal(h.layer.state().shown, 0);
  } finally { h.layer.destroy(); }
});

test('latest import/read wins, old markers are removed while reading and failed reads leave records untouched', async () => {
  const releases = [], h = harness(() => new Promise((resolve, reject) => releases.push({ resolve, reject })));
  try {
    const first = h.layer.setEnabled(true); releases[0].resolve(collection()); await first;
    h.eventBus.emit('astroeye:records-imported'); assert.equal(h.layer.state().shown, 0);
    const newest = h.layer.refresh(); releases[2].resolve(collection(['new'])); await newest;
    releases[1].resolve(collection(['old'])); await new Promise((resolve) => setImmediate(resolve));
    assert.ok(h.entities.getById(researchNoteEntityId('astroeye-note:new')));
    assert.equal(h.entities.getById(researchNoteEntityId('astroeye-note:old')), undefined);
    const failure = h.layer.refresh(); releases[3].reject(new Error('private error detail')); await failure;
    assert.equal(h.layer.state().shown, 0); assert.doesNotMatch(h.layer.state().error, /private error detail/);
    assert.deepEqual(h.entities.values, [h.unrelated]);
  } finally { h.layer.destroy(); }
});

test('render failure cleans only owned entities, including when an ID is already owned by someone else', async () => {
  const h = harness();
  const foreign = h.entities.add({ id: researchNoteEntityId('astroeye-note:b'), name: 'Foreign collision' });
  try {
    await h.layer.setEnabled(true);
    assert.equal(h.layer.state().shown, 0); assert.match(h.layer.state().error, /could not/);
    assert.deepEqual(h.entities.values, [h.unrelated, foreign]);
    h.entities.remove(foreign); await h.layer.refresh();
    const old = h.entities.getById(researchNoteEntityId('astroeye-note:a'));
    h.entities.remove(old); const replacement = h.entities.add({ id: old.id, name: 'Replacement owned elsewhere' });
    await h.layer.setEnabled(false); assert.ok(h.entities.contains(replacement));
  } finally { h.layer.destroy(); }
});
