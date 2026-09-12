import assert from 'node:assert/strict';
import test from 'node:test';
import { eventCalloutSpec, createEventCallouts } from './eventCallouts.js';
import { createAnnotationEngine } from '../../annotations/annotationEngine.js';

const selection = { event: { title: 'Example event', venue: { latitude: 40.7, longitude: -74 } },
  chart: { calculatedFor: '2026-11-01T05:30:15.000Z' } };

test('callout captures the exact chart time and explicit venue without geocoding hints', () => {
  const spec = eventCalloutSpec(selection, '<b>Note</b>');
  assert.equal(spec.label, 'AstroEye 2026-11-01 05:30:15 UTC · <b>Note</b>');
  assert.equal(spec.latitude, 40.7);
  assert.equal(spec.longitude, -74);
  assert.equal(spec.footprint, false);
  assert.equal(spec.target, undefined);
  assert.ok(eventCalloutSpec(selection, 'x'.repeat(40)).label.length <= 80);
  assert.match(eventCalloutSpec(selection).label, /Example event$/);
  for (const [input, note] of [[null, ''], [selection, 'x'.repeat(41)], [selection, {}],
    [{ ...selection, chart: { calculatedFor: 'bad' } }, '']]) assert.throws(() => eventCalloutSpec(input, note));
});

function harness() {
  let allowed = true, seq = 0;
  const marks = [{ id: 'other', owner: null, label: 'Other annotation' }];
  const calls = [];
  const annotations = {
    list: () => marks,
    async annotate(specs, options) {
      calls.push({ specs, options });
      const id = `mark-${++seq}`;
      marks.push({ id, owner: options.owner, ...specs[0] });
      return { ok: true, ids: [id] };
    },
    remove(id, { owner }) {
      const index = marks.findIndex((mark) => mark.id === id && mark.owner === owner);
      if (index < 0) return false;
      marks.splice(index, 1); return true;
    },
  };
  return { marks, calls, annotations, allow: (value) => { allowed = value; },
    service: createEventCallouts({ annotations, getSelection: () => selection, canInteract: () => allowed }) };
}

test('callouts use no camera assist, cap at five, and clear only AstroEye-owned marks', async () => {
  const h = harness();
  for (let i = 0; i < 5; i++) await h.service.add(`Note ${i}`);
  assert.equal(h.service.count(), 5);
  await assert.rejects(h.service.add('Too many'), /Five/);
  assert.deepEqual(h.calls[0].options, { owner: 'astroeye', persist: true, clearPrevious: false, flyTo: false, ensureVisible: false });
  assert.equal(h.service.clear(), 5);
  assert.deepEqual(h.marks, [{ id: 'other', owner: null, label: 'Other annotation' }]);
  h.allow(false); await assert.rejects(h.service.add('Blocked'), /Stop/);
});

test('clearing during a pending add disowns late output without clearing siblings', async () => {
  const h = harness();
  const original = h.annotations.annotate;
  let release;
  h.annotations.annotate = async (...args) => { await new Promise((resolve) => { release = resolve; }); return original(...args); };
  const pending = h.service.add('Pending');
  await assert.rejects(h.service.add('Concurrent'), /already/);
  h.service.clear(); release();
  assert.equal((await pending).cancelled, true);
  assert.equal(h.service.count(), 0);
  assert.equal(h.marks[0].id, 'other');
});

test('a cancelled duplicate does not remove a previously existing AstroEye callout', async () => {
  const h = harness();
  await h.service.add('Existing');
  h.annotations.annotate = async () => { h.allow(false); return { ok: true, ids: ['mark-1'] }; };
  assert.equal((await h.service.add('Existing')).cancelled, true);
  assert.equal(h.service.count(), 1);
});

test('engine scopes dedup/removal by owner and honors camera-assist opt-out', async (t) => {
  const raf = globalThis.requestAnimationFrame, caf = globalThis.cancelAnimationFrame;
  globalThis.requestAnimationFrame = () => 1;
  globalThis.cancelAnimationFrame = () => {};
  t.after(() => { globalThis.requestAnimationFrame = raf; globalThis.cancelAnimationFrame = caf; });
  let cameraReads = 0;
  const engine = createAnnotationEngine({
    viewer: { get camera() { cameraReads++; throw new Error('Camera must not be touched'); } },
    renderer: { add() {}, remove() {}, sync() {}, update() {} },
    resolveTarget: async () => ({ lon: -74, lat: 40.7, height: 0, source: 'coordinate' }),
  });
  t.after(() => engine.clear());
  const spec = eventCalloutSpec(selection, 'Identical');
  const other = await engine.annotate([spec], { ensureVisible: false });
  const owned = await engine.annotate([spec], { ensureVisible: false, owner: 'astroeye' });
  const duplicate = await engine.annotate([spec], { ensureVisible: false, owner: 'astroeye' });
  assert.equal(engine.count(), 2);
  assert.equal(duplicate.ids[0], owned.ids[0]);
  assert.equal(cameraReads, 0);
  assert.equal(engine.remove(other.ids[0], { owner: 'astroeye' }), false);
  assert.equal(engine.remove(owned.ids[0], { owner: 'another-module' }), false);
  assert.equal(engine.remove(owned.ids[0], { owner: 'astroeye' }), true);
  assert.equal(engine.count(), 1);
  assert.equal(engine.list()[0].id, other.ids[0]);
});
