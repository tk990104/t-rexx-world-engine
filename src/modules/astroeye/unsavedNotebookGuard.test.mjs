import assert from 'node:assert/strict';
import test from 'node:test';
import { createUnsavedNotebookGuard } from './unsavedNotebookGuard.js';

function fixture() {
  const listeners = new Set(); let adds = 0, removes = 0;
  const target = {
    addEventListener(type, listener) { assert.equal(type, 'beforeunload'); adds++; listeners.add(listener); },
    removeEventListener(type, listener) { assert.equal(type, 'beforeunload'); removes++; listeners.delete(listener); },
  };
  const guard = createUnsavedNotebookGuard(target);
  return { guard, listeners, counts: () => [adds, removes], dispatch() {
    const event = { prevented: false, returnValue: undefined, preventDefault() { this.prevented = true; } };
    for (const listener of listeners) listener(event);
    return event;
  } };
}

test('clean notes attach nothing; dirty notes request a standard warning exactly once', () => {
  const f = fixture();
  f.guard.setDirty(false); assert.deepEqual(f.counts(), [0, 0]);
  assert.equal(f.dispatch().prevented, false);
  f.guard.setDirty(true); f.guard.setDirty(true);
  assert.deepEqual(f.counts(), [1, 0]);
  const event = f.dispatch(); assert.equal(event.prevented, true); assert.equal(event.returnValue, '');
  f.guard.setDirty(false); f.guard.setDirty(false);
  assert.deepEqual(f.counts(), [1, 1]); assert.equal(f.dispatch().prevented, false);
});

test('guard can re-arm after save and teardown removes only its own listener', () => {
  const f = fixture(); let otherCalls = 0;
  const other = () => { otherCalls++; }; f.listeners.add(other);
  f.guard.setDirty(true); f.guard.setDirty(false); f.guard.setDirty(true);
  assert.equal(f.dispatch().prevented, true);
  f.guard.destroy(); f.guard.destroy(); f.guard.setDirty(true);
  assert.equal(f.dispatch().prevented, false);
  assert.deepEqual([...f.listeners], [other]); assert.equal(otherCalls, 2);
  assert.deepEqual(f.counts(), [2, 2]);
});
