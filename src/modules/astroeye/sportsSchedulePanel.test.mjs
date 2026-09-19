import assert from 'node:assert/strict';
import test from 'node:test';
import { mountSportsSchedulePanel } from './sportsSchedulePanel.js';
import { readSourceSync } from '../../testSupport/sourceText.mjs';

// Small DOM seam for request lifecycle tests; actual rendering/focus needs QA.
function fixture({ holdSchedule = false } = {}) {
  const element = () => ({ dataset: {}, disabled: false, textContent: '', children: [], attributes: {},
    setAttribute(name, value) { this.attributes[name] = value; },
    append(...nodes) { this.children.push(...nodes); }, replaceChildren() { this.children = []; } });
  const nodes = Object.fromEntries(['next', 'day', 'cancel', 'date', 'results', 'status', 'scope'].map(name => [name, element()]));
  nodes.next.dataset.schedule = 'next'; nodes.day.dataset.schedule = 'day';
  nodes.cancel.dataset.schedule = 'cancel'; nodes.cancel.hidden = true;
  const listeners = new Map(), calls = [], selections = [];
  const host = { ownerDocument: { activeElement: null }, contains: () => false,
    querySelector: selector => nodes[selector.match(/"(\w+)"/)[1]],
    querySelectorAll: () => [nodes.next, nodes.day, nodes.cancel, ...nodes.results.children],
    addEventListener: (name, listener) => listeners.set(name, listener),
    removeEventListener: (name, listener) => { assert.equal(listeners.get(name), listener); listeners.delete(name); },
  };
  const response = { events: [{ title: 'Synthetic game', venueId: 'one', utcStart: null, status: 'NS' }], retrievedAt: '2026-09-19T12:00:00Z' };
  const hold = (kind, signal, value) => new Promise((resolve, reject) => calls.push({ kind, signal, value, resolve, reject }));
  const savedDocument = globalThis.document;
  globalThis.document = { createElement: element };
  const panel = mountSportsSchedulePanel(host, { onSelect: (...args) => selections.push(args),
    client: { schedule: (value, signal) => holdSchedule ? hold('schedule', signal, value) : Promise.resolve(response),
      venue: (_, signal) => hold('venue', signal) },
  });
  const click = node => listeners.get('click')?.({ target: { closest: () => node } });
  return { panel, nodes, calls, selections, listeners, response, click,
    async load() { await click(nodes.next); },
    dispose() { if (listeners.size) panel.destroy(); globalThis.document = savedDocument; },
  };
}

for (const fail of [false, true]) test(`manual-edit cancellation rejects late ${fail ? 'failure' : 'success'} without handoff`, async () => {
  const f = fixture();
  try {
    await f.load(); const task = f.click(f.nodes.results.children[0]);
    assert.equal(f.panel.cancelSelection(), true); assert.equal(f.panel.cancelSelection(), false);
    assert.equal(f.calls[0].signal.aborted, true);
    const message = f.nodes.status.textContent;
    assert.match(message, /preserve your form edits/);
    if (fail) f.calls[0].reject(new Error('Late synthetic error')); else f.calls[0].resolve({ venue: {} });
    await task;
    assert.deepEqual(f.selections, []); assert.equal(f.nodes.status.textContent, message);
    assert.equal(f.nodes.next.disabled, false);
  } finally { f.dispose(); }
});

test('manual edits leave read-only schedule discovery running', async () => {
  const f = fixture({ holdSchedule: true });
  try {
    const task = f.click(f.nodes.next);
    assert.equal(f.panel.cancelSelection(), false); assert.equal(f.calls[0].signal.aborted, false);
    f.calls[0].resolve(f.response); await task;
    assert.equal(f.nodes.results.children.length, 1); assert.equal(f.nodes.next.disabled, false);
  } finally { f.dispose(); }
});

test('stale completion cannot enable or replace a newer explicit selection', async () => {
  const f = fixture();
  try {
    await f.load(); const first = f.click(f.nodes.results.children[0]);
    f.panel.cancelSelection(); const second = f.click(f.nodes.results.children[0]);
    f.calls[0].resolve({ venue: { name: 'Old' } }); await first;
    assert.equal(f.nodes.next.disabled, true); assert.equal(f.selections.length, 0);
    f.calls[1].resolve({ venue: { name: 'New' } }); await second;
    assert.equal(f.selections.length, 1); assert.equal(f.selections[0][1].name, 'New');
    assert.equal(f.nodes.next.disabled, false); assert.equal(f.panel.cancelSelection(), false);
  } finally { f.dispose(); }
});

test('destruction aborts selection and makes subsequent cancellation inert', async () => {
  const f = fixture();
  try {
    await f.load(); const task = f.click(f.nodes.results.children[0]); f.panel.destroy();
    assert.equal(f.calls[0].signal.aborted, true); assert.equal(f.panel.cancelSelection(), false);
    f.calls[0].resolve({ venue: {} }); await task;
    assert.equal(f.listeners.size, 0); assert.equal(f.selections.length, 0);
  } finally { f.dispose(); }
});

for (const kind of ['schedule', 'selection']) for (const fail of [false, true]) {
  test(`Cancel lookup stops ${kind} and ignores late ${fail ? 'failure' : 'success'}`, async () => {
    const f = fixture({ holdSchedule: kind === 'schedule' });
    try {
      if (kind === 'selection') await f.load();
      const task = f.click(kind === 'schedule' ? f.nodes.next : f.nodes.results.children[0]);
      assert.equal(f.nodes.cancel.hidden, false); assert.equal(f.nodes.cancel.disabled, false);
      assert.equal(f.nodes.next.disabled, true);
      await f.click(f.nodes.cancel);
      const message = f.nodes.status.textContent;
      assert.match(message, /lookup cancelled/); assert.doesNotMatch(message, /Loading/);
      assert.equal(f.calls[0].signal.aborted, true); assert.equal(f.nodes.cancel.hidden, true);
      assert.equal(f.nodes.next.disabled, false);
      if (fail) f.calls[0].reject(new Error('Late error'));
      else f.calls[0].resolve(kind === 'schedule' ? f.response : { venue: {} });
      await task; await f.click(f.nodes.cancel);
      assert.equal(f.nodes.status.textContent, message); assert.equal(f.selections.length, 0);
      if (kind === 'schedule') assert.equal(f.nodes.results.children.length, 0);
    } finally { f.dispose(); }
  });
}

test('workspace close cancellation replaces Loading with retry guidance', async () => {
  const f = fixture({ holdSchedule: true });
  try {
    const task = f.click(f.nodes.next); f.panel.cancel();
    assert.match(f.nodes.status.textContent, /Schedule lookup cancelled/);
    f.calls[0].resolve(f.response); await task;
    assert.match(f.nodes.status.textContent, /try again/);
  } finally { f.dispose(); }
});

test('idle cancellation preserves a completed result status', async () => {
  const f = fixture();
  try {
    await f.load(); const message = f.nodes.status.textContent;
    f.panel.cancel(); assert.equal(f.nodes.status.textContent, message);
    assert.equal(f.nodes.cancel.hidden, true);
  } finally { f.dispose(); }
});

for (const event of ['input', 'change']) for (const fail of [false, true]) {
  test(`${event} date edit cancels a dated search and rejects late ${fail ? 'failure' : 'success'}`, async () => {
    const f = fixture({ holdSchedule: true });
    try {
      f.nodes.date.value = '2026-09-19'; const task = f.click(f.nodes.day);
      assert.equal(f.calls[0].value, '2026-09-19');
      f.nodes.date.value = '2026-09-20'; f.listeners.get(event)({ target: f.nodes.date });
      assert.equal(f.calls[0].signal.aborted, true); assert.equal(f.calls.length, 1);
      const message = f.nodes.status.textContent;
      assert.match(message, /Schedule date changed/); assert.equal(f.nodes.cancel.hidden, true);
      if (fail) f.calls[0].reject(new Error('Late dated failure')); else f.calls[0].resolve(f.response);
      await task;
      assert.equal(f.nodes.results.children.length, 0); assert.equal(f.nodes.scope.hidden, true);
      assert.equal(f.nodes.status.textContent, message); assert.equal(f.nodes.next.disabled, false);
    } finally { f.dispose(); }
  });
}

test('settlement detects a changed date even without an input event', async () => {
  const f = fixture({ holdSchedule: true });
  try {
    f.nodes.date.value = '2026-09-19'; const task = f.click(f.nodes.day);
    f.nodes.date.value = ''; f.calls[0].resolve(f.response); await task;
    assert.equal(f.nodes.results.children.length, 0); assert.match(f.nodes.status.textContent, /Schedule date changed/);
  } finally { f.dispose(); }
});

test('completed and empty results retain the captured UTC query label until another search', async () => {
  const f = fixture({ holdSchedule: true });
  try {
    f.nodes.date.value = '2026-09-19'; const first = f.click(f.nodes.day);
    f.calls[0].resolve(f.response); await first;
    const label = 'NFL games for 2026-09-19 (UTC)';
    assert.equal(f.nodes.scope.textContent, label); assert.equal(f.nodes.results.attributes['aria-label'], label);
    f.nodes.date.value = '2026-09-20'; f.listeners.get('input')({ target: f.nodes.date });
    assert.equal(f.calls.length, 1); assert.equal(f.nodes.scope.textContent, label);
    const second = f.click(f.nodes.day);
    assert.equal(f.nodes.scope.hidden, true);
    f.calls[1].resolve({ ...f.response, events: [] }); await second;
    assert.equal(f.nodes.scope.textContent, 'NFL games for 2026-09-20 (UTC)');
    assert.match(f.nodes.status.textContent, /2026-09-20.*No games/);
  } finally { f.dispose(); }
});

test('date changes do not cancel or relabel Upcoming searches or venue selection', async () => {
  const f = fixture({ holdSchedule: true });
  try {
    const task = f.click(f.nodes.next);
    f.nodes.date.value = '2026-09-20'; f.listeners.get('change')({ target: f.nodes.date });
    assert.equal(f.calls[0].signal.aborted, false); assert.equal(f.calls[0].value, null);
    f.calls[0].resolve(f.response); await task;
    assert.equal(f.nodes.scope.textContent, 'Upcoming NFL games');
    const selection = f.click(f.nodes.results.children[0]);
    f.nodes.date.value = ''; f.listeners.get('input')({ target: f.nodes.date });
    assert.equal(f.calls[1].signal.aborted, false);
    f.calls[1].resolve({ venue: {} }); await selection;
    assert.equal(f.selections.length, 1); assert.equal(f.nodes.scope.textContent, 'Upcoming NFL games');
  } finally { f.dispose(); }
});

test('same-date and unrelated field events do not cancel the search', async () => {
  const f = fixture({ holdSchedule: true });
  try {
    const task = f.click(f.nodes.day);
    f.listeners.get('input')({ target: f.nodes.date });
    f.listeners.get('change')({ target: {} });
    assert.equal(f.calls[0].signal.aborted, false);
    f.calls[0].resolve(f.response); await task;
    assert.equal(f.nodes.results.children.length, 1);
  } finally { f.dispose(); }
});

test('an obsolete dated response cannot enable controls or relabel a replacement search', async () => {
  const f = fixture({ holdSchedule: true });
  try {
    f.nodes.date.value = '2026-09-19'; const first = f.click(f.nodes.day);
    f.nodes.date.value = '2026-09-20'; f.listeners.get('input')({ target: f.nodes.date });
    const second = f.click(f.nodes.day);
    f.calls[0].resolve(f.response); await first;
    assert.equal(f.nodes.next.disabled, true); assert.equal(f.nodes.scope.hidden, true);
    assert.equal(f.calls[1].signal.aborted, false);
    f.calls[1].resolve(f.response); await second;
    assert.equal(f.nodes.scope.textContent, 'NFL games for 2026-09-20 (UTC)');
  } finally { f.dispose(); }
});

test('workspace wires both input and change-only edits to selection cancellation', () => {
  const source = readSourceSync(new URL('astroeyeWorkspace.js', import.meta.url));
  assert.match(source, /form.addEventListener\('change', \(\) => schedulePanel.cancelSelection\(\)\)/);
  assert.match(source, /form.addEventListener\('input', \(event\) => \{\s*schedulePanel.cancelSelection\(\);/);
});
