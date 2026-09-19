import test from 'node:test';
import assert from 'node:assert/strict';
import { consumeWorkspaceEscape } from './workspaceKeyboard.js';
import { readSourceSync } from '../../testSupport/sourceText.mjs';

function keyboard(overrides = {}) {
  const calls = [];
  return { calls, event: { key: 'Escape', defaultPrevented: false, isComposing: false, keyCode: 27,
    preventDefault() { calls.push('prevent'); this.defaultPrevented = true; },
    stopPropagation() { calls.push('stop'); }, ...overrides } };
}

test('ordinary Escape is consumed once so ancestor shortcuts cannot also act', () => {
  const { event, calls } = keyboard();
  assert.equal(consumeWorkspaceEscape(event), true);
  assert.deepEqual(calls, ['prevent', 'stop']);
  assert.equal(consumeWorkspaceEscape(event), false);
  assert.deepEqual(calls, ['prevent', 'stop']);
});
for (const [name, overrides] of [
  ['other keys', { key: 'Enter' }],
  ['child-handled Escape', { defaultPrevented: true }],
  ['active text composition', { isComposing: true }],
  ['legacy composition notification', { keyCode: 229 }],
]) {
  test(`${name} neither closes the workspace nor changes event handling`, () => {
    const { event, calls } = keyboard(overrides);
    assert.equal(consumeWorkspaceEscape(event), false);
    assert.deepEqual(calls, []);
  });
}
test('workspace checks Escape ownership before cancellation or close', () => {
  const source = readSourceSync(new URL('astroeyeWorkspace.js', import.meta.url));
  assert.match(source, /if \(!consumeWorkspaceEscape\(event\)\) return;\s*resetImportReview\(\);\s*schedulePanel.cancel\(\);/);
});

test('venue details uses the shared Escape guard and dismissal independent of pending actions', () => {
  const source = readSourceSync(new URL('venueContextPanel.js', import.meta.url));
  assert.match(source, /if \(!consumeWorkspaceEscape\(event\)\) return;\s*void dismiss\(\);/);
  assert.match(source, /if \(kind === 'close'\) void dismiss\(\);/);
  assert.match(source, /async function dismiss\(\) \{\s*if \(closing \|\| disposed \|\| !canInteract\(\)\) return;/);
  assert.match(source, /await callouts.add\([^;]+;\s*if \(disposed\) return;/);
});
