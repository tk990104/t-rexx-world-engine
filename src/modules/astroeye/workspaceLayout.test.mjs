import test from 'node:test';
import assert from 'node:assert/strict';
import { stickyWorkspaceInset, focusScrollAdjustment, installWorkspaceFocusVisibility } from './workspaceLayout.js';

function root(header, navigation) {
  const element = (spec) => spec && ({ style: spec, getBoundingClientRect: () => ({ height: spec.height }) });
  const elements = { '.astroeye-header': element(header), '.astroeye-quick-nav': element(navigation) };
  return { ownerDocument: { defaultView: { getComputedStyle: (node) => node.style } },
    querySelector: (selector) => elements[selector] };
}
test('wide shortcut inset uses sticky navigation, not the scrolling header', () => {
  assert.equal(stickyWorkspaceInset(root({ position: 'static', height: 120 },
    { position: 'sticky', top: '0px', height: 64 })), 64);
});
test('narrow shortcut inset follows the sticky header instead of wrapped shortcuts', () => {
  assert.equal(stickyWorkspaceInset(root({ position: 'sticky', top: '0px', height: 107 },
    { position: 'static', height: 180 })), 107);
});
test('hidden compact header and nonsticky navigation reserve no space', () => {
  assert.equal(stickyWorkspaceInset(root({ display: 'none', position: 'sticky', height: 107 },
    { position: 'static', height: 180 })), 0);
});
test('missing DOM pieces and auto offsets are safe', () => {
  assert.equal(stickyWorkspaceInset({ querySelector: () => null }), 0);
  assert.equal(stickyWorkspaceInset(root(null, null)), 0);
  assert.equal(stickyWorkspaceInset(root(null, { position: 'sticky', top: 'auto', height: 64 })), 64);
});

test('focused controls clear sticky top and bottom boundaries with the minimum scroll', () => {
  assert.equal(focusScrollAdjustment({ top: 33, bottom: 71 }, 131, 428), -98);
  assert.equal(focusScrollAdjustment({ top: 410, bottom: 454 }, 131, 428), 26);
  assert.equal(focusScrollAdjustment({ top: 131, bottom: 428 }, 131, 428), 0);
  assert.equal(focusScrollAdjustment({ top: 170, bottom: 214 }, 131, 428), 0);
});
test('oversized sections and invalid geometry do not create scrolling oscillations', () => {
  assert.equal(focusScrollAdjustment({ top: 150, bottom: 800 }, 131, 428), 0);
  assert.equal(focusScrollAdjustment({ top: 450, bottom: 1100 }, 131, 428), 319);
  for (const bounds of [{ top: NaN, bottom: 2 }, { top: 5, bottom: 3 }]) {
    assert.equal(focusScrollAdjustment(bounds, 1, 100), 0);
  }
  assert.equal(focusScrollAdjustment({ top: 10, bottom: 30 }, 50, 40), 0);
});
function focusHarness() {
  const tasks = [], seen = [], listeners = new Map(), targets = new Set();
  const host = { hidden: false, isConnected: true, ownerDocument: { activeElement: null },
    contains: (target) => targets.has(target),
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: (name, fn) => { assert.equal(listeners.get(name), fn); listeners.delete(name); } };
  const dispose = installWorkspaceFocusVisibility(host, { queue: (fn) => tasks.push(fn), reveal: (node, target) => { assert.equal(node, host); seen.push(target); } });
  return { host, seen, listeners, targets, dispose,
    focus(target) { targets.add(target); host.ownerDocument.activeElement = target; listeners.get('focusin')({ target }); },
    flush() { tasks.splice(0).forEach((fn) => fn()); } };
}
test('focus visibility is dormant until focus and coalesces superseded focus', () => {
  const h = focusHarness(), a = {}, b = {};
  assert.equal(h.seen.length, 0); h.focus(a); h.focus(b); h.flush();
  assert.deepEqual(h.seen, [b]);
});
test('hidden, detached, removed or externally moved focus never scrolls', () => {
  for (const change of [(h) => { h.host.hidden = true; }, (h) => { h.host.isConnected = false; },
    (h) => h.targets.clear(), (h) => { h.host.ownerDocument.activeElement = {}; }]) {
    const h = focusHarness(); h.focus({}); change(h); h.flush(); assert.equal(h.seen.length, 0);
  }
});
test('disposal removes its listener and invalidates pending focus work', () => {
  const h = focusHarness(); h.focus({}); h.dispose(); h.flush();
  assert.equal(h.seen.length, 0); assert.equal(h.listeners.size, 0);
});
