import assert from 'node:assert/strict';
import test from 'node:test';
import { capturePanelOperationFocus } from './panelOperationFocus.js';
import { readSourceSync } from '../../testSupport/sourceText.mjs';

function fixture() {
  const listeners = new Map(), children = new Set(), focused = [];
  const document = { body: {}, hidden: false, activeElement: null,
    addEventListener(name, handler, capture) { assert.equal(capture, true); listeners.set(name, handler); },
    removeEventListener(name, handler, capture) { assert.equal(capture, true); assert.equal(listeners.get(name), handler); listeners.delete(name); },
    defaultView: { getComputedStyle: (node) => ({ visibility: node.visibility ?? 'visible' }) } };
  const host = { ownerDocument: document, isConnected: true, contains: (node) => children.has(node) };
  const element = (name) => {
    const node = { name, isConnected: true, disabled: false, hiddenAncestor: false, rects: [{}],
      closest() { return this.hiddenAncestor ? host : null; }, getClientRects() { return this.rects; },
      focus() { document.activeElement = this; focused.push(name); } };
    children.add(node); return node;
  };
  const origin = element('origin'), editor = element('editor');
  document.activeElement = origin;
  return { document, host, listeners, children, focused, origin, editor, element };
}

test('re-enabled origin regains focus and listeners clean up exactly once', () => {
  const f = fixture(), restore = capturePanelOperationFocus(f.host);
  f.document.activeElement = f.document.body;
  restore({ fallback: [f.editor] }); restore();
  assert.deepEqual(f.focused, ['origin']); assert.equal(f.listeners.size, 0);
});
test('disabled clean-save button falls back to the editor after render', () => {
  const f = fixture(), restore = capturePanelOperationFocus(f.host);
  f.origin.disabled = true; f.document.activeElement = f.document.body;
  restore({ fallback: [f.editor] });
  assert.deepEqual(f.focused, ['editor']);
});
test('new draft can prefer editor over the original action', () => {
  const f = fixture(), restore = capturePanelOperationFocus(f.host);
  restore({ preferred: [f.editor] }); assert.deepEqual(f.focused, ['editor']);
});
for (const event of ['keydown', 'pointerdown', 'focusin']) {
  test(`${event} during pending work relinquishes restoration even if focus returns to body`, () => {
    const f = fixture(), restore = capturePanelOperationFocus(f.host);
    f.listeners.get(event)({ target: f.editor }); f.document.activeElement = f.document.body;
    restore({ preferred: [f.editor] });
    assert.deepEqual(f.focused, []); assert.equal(f.listeners.size, 0);
  });
}
test('a browser blur to body is not mistaken for a new user destination', () => {
  const f = fixture(), restore = capturePanelOperationFocus(f.host);
  f.listeners.get('focusin')({ target: f.document.body });
  f.document.activeElement = f.document.body; restore();
  assert.deepEqual(f.focused, ['origin']);
});
test('background, detached, externally focused and explicitly cancelled operations never restore', () => {
  for (const alter of [f => { f.document.hidden = true; }, f => { f.host.isConnected = false; },
    f => { f.document.activeElement = {}; }, f => { f.cancel = true; }]) {
    const f = fixture(), restore = capturePanelOperationFocus(f.host);
    alter(f); restore({ cancel: f.cancel, preferred: [f.editor] });
    assert.deepEqual(f.focused, []); assert.equal(f.listeners.size, 0);
  }
});
test('hidden, inert, non-rendered, detached and removed targets are skipped', () => {
  for (const alter of [node => { node.hiddenAncestor = true; }, node => { node.visibility = 'hidden'; },
    node => { node.visibility = 'collapse'; }, node => { node.rects = []; }, node => { node.isConnected = false; }]) {
    const f = fixture(), restore = capturePanelOperationFocus(f.host);
    alter(f.origin); restore({ fallback: [null, f.editor] });
    assert.deepEqual(f.focused, ['editor']);
  }
  const f = fixture(), restore = capturePanelOperationFocus(f.host);
  f.children.delete(f.origin); restore(); assert.deepEqual(f.focused, []);
});
test('automatic loading with external focus installs no listeners and does not move focus', () => {
  const f = fixture(); f.document.activeElement = f.document.body;
  const restore = capturePanelOperationFocus(f.host);
  assert.equal(f.listeners.size, 0); restore({ preferred: [f.editor] });
  assert.deepEqual(f.focused, []);
});
test('both editors restore only after enabling controls and cancel on teardown or suspension', () => {
  for (const file of ['researchNotebookPanel.js', 'researchAnnotationsPanel.js']) {
    const source = readSourceSync(new URL(file, import.meta.url));
    assert.match(source, /pendingFocus = capturePanelOperationFocus\(host\)/);
    assert.match(source, /if \(!destroyed\) render\(\);\s*restoreFocus\(/);
    assert.match(source, /destroy\(\) \{ destroyed = true; pendingFocus\?\.\(\{ cancel: true \}\)/);
  }
  const annotations = readSourceSync(new URL('researchAnnotationsPanel.js', import.meta.url));
  assert.match(annotations, /if \(value === true\) pendingFocus\?\.\(\{ cancel: true \}\)/);
  assert.doesNotMatch(annotations, /\.then\(\(\) => .*editor.focus/);
});
