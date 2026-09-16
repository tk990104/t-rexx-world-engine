import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeRenderCheck } from './renderCheckSummary.js';

function report(overrides = {}) {
  const endpoint = { governorMode: 'idle', continuousHolds: 0, eventSkyEnabled: false };
  return { status: 'completed', reason: 'completed', elapsedMs: 10006, renderedFrames: 0,
    before: { ...endpoint }, after: { ...endpoint }, ephemerisUpdateDelta: 0, ...overrides };
}

test('idle summary describes observed counts without claiming a performance pass', () => {
  const value = report(), original = structuredClone(value);
  const text = summarizeRenderCheck(value);
  assert.match(text, /0 scene renders in 10.01 seconds/);
  assert.match(text, /Zero renders can be normal/);
  assert.match(text, /At both endpoints: idle mode, 0 continuous-render holds, event sky off/);
  assert.match(text, /do not prove/);
  assert.match(text, /not a frame-rate benchmark or release pass/);
  assert.deepEqual(value, original);
});

test('active renders and ephemeris updates are reported without FPS inference', () => {
  const text = summarizeRenderCheck(report({ renderedFrames: 601, ephemerisUpdateDelta: 2 }));
  assert.match(text, /601 scene renders/); assert.match(text, /increased by 2/);
  assert.doesNotMatch(text, /Zero renders|FPS|60\.1/);
});

test('changed endpoints caution against fixed-configuration interpretation', () => {
  for (const change of [{ governorMode: 'continuous' }, { continuousHolds: 1 }, { eventSkyEnabled: true }]) {
    const value = report(); Object.assign(value.after, change);
    assert.match(summarizeRenderCheck(value), /configuration differed/);
  }
});

test('missing and reset counters do not become zero measurements', () => {
  const text = summarizeRenderCheck(report({ after: null, ephemerisUpdateDelta: null }));
  assert.match(text, /configuration counters are unavailable/);
  assert.match(text, /Ephemeris change is unavailable/);
  assert.doesNotMatch(text, /At both endpoints|increased by 0/);
});

test('incomplete reasons have actionable explanations and never display measured renders', () => {
  for (const reason of ['interaction', 'tab-hidden', 'cancelled', 'disposed', 'timer-outside-window', 'counter-read-failed', 'observer-unavailable']) {
    const text = summarizeRenderCheck(report({ status: 'incomplete', reason }));
    assert.match(text, /Observation incomplete/); assert.match(text, /No performance conclusion/);
    assert.doesNotMatch(text, /Observed 0/);
  }
});

test('unknown reasons and extra fields never enter summary text', () => {
  for (const reason of ['PRIVATE-ERROR', '__proto__', 'constructor']) {
    const text = summarizeRenderCheck(report({ status: 'incomplete', reason, secret: 'PRIVATE' }));
    assert.match(text, /did not complete/); assert.doesNotMatch(text, /PRIVATE|__proto__|constructor/);
  }
  assert.match(summarizeRenderCheck(null), /incomplete/);
});

test('invalid timing and counts fail closed', () => {
  for (const overrides of [{ elapsedMs: 9999 }, { elapsedMs: 15001 }, { elapsedMs: NaN }, { renderedFrames: -1 }, { renderedFrames: 0.5 }]) {
    assert.match(summarizeRenderCheck(report(overrides)), /missing or invalid timing data/);
  }
});
