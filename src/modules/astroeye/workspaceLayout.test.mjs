import test from 'node:test';
import assert from 'node:assert/strict';
import { stickyWorkspaceInset } from './workspaceLayout.js';

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
