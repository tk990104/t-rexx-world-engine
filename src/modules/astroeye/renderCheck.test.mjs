import assert from 'node:assert/strict';
import test from 'node:test';
import { createRenderCheck, RENDER_CHECK_MS } from './renderCheck.js';
import { CelestialRing } from '../../celestialRing.js';

function harness() {
  let time = 0, scheduled, reads = 0;
  const frames = new Set(), listeners = new Map();
  const state = { governorMode: 'idle', continuousHolds: 0, eventSkyEnabled: true, ephemerisUpdates: 1,
    time: 'PRIVATE-TIME', coordinates: 'PRIVATE-COORDINATES', holds: ['PRIVATE-OWNER'] };
  const document = { hidden: false,
    addEventListener(name, fn) { listeners.set(name, fn); },
    removeEventListener(name, fn) { if (listeners.get(name) === fn) listeners.delete(name); } };
  const check = createRenderCheck({ document,
    postRender: { addEventListener(fn) { frames.add(fn); return () => frames.delete(fn); } },
    readCounters: () => { reads++; return state; }, now: () => time,
    schedule: (fn, delay) => { assert.equal(delay, RENDER_CHECK_MS); scheduled = fn; return 1; },
    unschedule: () => { scheduled = null; } });
  return { check, document, state, frames, listeners, reads: () => reads,
    frame: () => frames.forEach((fn) => fn()),
    complete: (elapsed = RENDER_CHECK_MS) => { time = elapsed; scheduled(); },
    emit: (name) => listeners.get(name)?.(),
    assertClean() { assert.equal(frames.size, 0); assert.equal(listeners.size, 0); assert.equal(scheduled, null); } };
}

test('render observation is dormant until started and only counts externally supplied frames', async () => {
  const h = harness();
  assert.equal(h.reads(), 0); assert.equal(h.frames.size, 0);
  const pending = h.check.start();
  h.frame(); h.frame(); h.frame();
  assert.equal(h.reads(), 1, 'No per-frame counter reads');
  h.complete(); const report = await pending;
  assert.equal(report.status, 'completed'); assert.equal(report.renderedFrames, 3);
  assert.equal(report.elapsedMs, 10000); assert.equal(report.ephemerisUpdateDelta, 0);
  assert.equal(h.reads(), 2); h.assertClean();
  assert.equal(JSON.stringify(report).includes('PRIVATE'), false);
});

test('zero renders is a completed observation, not a failed frame-rate test', async () => {
  const h = harness(), pending = h.check.start();
  h.complete(); const report = await pending;
  assert.equal(report.status, 'completed'); assert.equal(report.renderedFrames, 0);
  assert.match(report.acceptance, /observation-only/); h.assertClean();
});

test('duplicate starts are refused; cancel cleans up and allows another bounded run', async () => {
  const h = harness(), pending = h.check.start();
  assert.throws(() => h.check.start(), /already running/);
  h.check.cancel(); assert.equal((await pending).reason, 'cancelled'); h.assertClean();
  const next = h.check.start(); h.complete(); assert.equal((await next).status, 'completed'); h.assertClean();
});

test('hidden tabs, input and disposal stop observation without a completed result', async () => {
  for (const reason of ['tab-hidden', 'pointerdown', 'keydown', 'wheel', 'disposed']) {
    const h = harness(), pending = h.check.start();
    if (reason === 'tab-hidden') { h.document.hidden = true; h.emit('visibilitychange'); }
    else if (reason === 'disposed') h.check.destroy();
    else h.emit(reason);
    assert.equal((await pending).status, 'incomplete'); h.assertClean();
    if (reason === 'disposed') assert.throws(() => h.check.start(), /disposed/);
  }
  const h = harness(); h.document.hidden = true;
  assert.throws(() => h.check.start(), /visible/); assert.equal(h.reads(), 0);
});

test('late or early timers cannot claim a valid ten-second window', async () => {
  for (const elapsed of [9999, 15001]) {
    const h = harness(), pending = h.check.start(); h.complete(elapsed);
    assert.equal((await pending).reason, 'timer-outside-window'); h.assertClean();
  }
});

test('counters are allowlisted and reset/missing counters never fabricate a delta', async () => {
  const h = harness(), pending = h.check.start();
  h.state.ephemerisUpdates = 0; h.state.continuousHolds = NaN; h.state.governorMode = 'PRIVATE';
  h.complete(); const report = await pending;
  assert.equal(report.ephemerisUpdateDelta, null); assert.equal(report.after.continuousHolds, null);
  assert.equal(report.after.governorMode, 'unknown');
  assert.equal(JSON.stringify(report).includes('PRIVATE'), false); h.assertClean();
});

test('counter failure and observer setup failure resolve incompletely with owned cleanup', async () => {
  const document = { hidden: false, addEventListener() {}, removeEventListener() {} };
  let removed = 0, callback, reads = 0;
  const check = createRenderCheck({ document, postRender: { addEventListener: () => () => removed++ },
    now: () => 0, schedule: (fn) => { callback = fn; }, unschedule() {},
    readCounters: () => { if (reads++) throw new Error('Private failure text'); return {}; } });
  const pending = check.start(); callback(); const result = await pending;
  assert.equal(result.reason, 'counter-read-failed'); assert.equal(result.after, null); assert.equal(removed, 1);
  const broken = createRenderCheck({ document, postRender: { addEventListener() { throw new Error('fail'); } },
    readCounters: () => ({}), now: () => 0, unschedule() {} });
  assert.equal((await broken.start()).reason, 'observer-unavailable');
});

test('ring performance API omits event time, vectors and geometry and returns detached counters', () => {
  const ring = Object.create(CelestialRing.prototype);
  ring._directionSnapshot = { owner: 'astroeye', time: 'PRIVATE', sun: { x: 1 } }; ring._ephemerisUpdateCount = 7;
  assert.deepEqual(ring.getPerformanceCounters(), { eventSkyEnabled: true, ephemerisUpdates: 7 });
  const value = ring.getPerformanceCounters(); value.ephemerisUpdates = 99;
  assert.equal(ring.getPerformanceCounters().ephemerisUpdates, 7);
});
