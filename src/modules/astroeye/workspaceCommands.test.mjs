import assert from 'node:assert/strict';
import test from 'node:test';
import { CommandRegistry } from '../../core/commandRegistry.js';
import { PanelRegistry } from '../../core/panelRegistry.js';
import { installAstroEyeWorkspaceCommands } from './workspaceCommands.js';
import { ASTROEYE_MANIFEST } from './manifest.js';

function harness(overrides = {}) {
  const state = { busy: false, version: 0, allowed: true, marked: 0, calls: [] };
  const workspace = { root: { hidden: true }, isBusy: () => state.busy, interactionVersion: () => state.version,
    markCommandInteraction: () => { state.marked++; },
    selectSavedEvent: async (id, options) => {
      state.busy = true;
      try { assert.equal(options.isCurrent(), true); state.calls.push(['select', id, options.navigate, options.persistChart]); return true; }
      finally { state.busy = false; }
    },
    previewCommandTime: (minutes, { isCurrent }) => { if (!isCurrent()) return false; state.calls.push(['preview', minutes]); return true; },
    setCommandSky: (enabled, { focus, isCurrent }) => { if (!isCurrent()) return false; state.calls.push(['sky', enabled, focus]); return true; },
  };
  const registry = new CommandRegistry(), panels = new PanelRegistry();
  panels.register({ id: 'astroeye-workspace', owner: 'astroeye', title: 'AstroEye',
    mount: (_host, { isCurrent }) => { if (isCurrent()) workspace.root.hidden = false; return () => { workspace.root.hidden = true; }; } });
  panels.register({ id: 'other', owner: 'other', title: 'Other', mount: () => {} });
  const controller = { selectionSnapshot: () => ({ event: { id: 'one' } }), listEvents: async () => [{ id: 'one', title: 'One' }] };
  const services = { registry, panels, controller, workspace, host: {}, canInteract: () => state.allowed,
    flyToVenue: ({ isCurrent }) => { if (!isCurrent()) return false; state.calls.push(['fly']); return true; }, ...overrides };
  const installed = installAstroEyeWorkspaceCommands(services);
  return { ...services, state, installed, run: (name, args) => registry.execute(`astroeye_${name}`, args) };
}

test('shell installation matches manifest and calls workspace adapters without self-cancelling on owned loading', async () => {
  const h = harness();
  assert.deepEqual(h.registry.list({ owner: 'astroeye' }).map((c) => c.name), ASTROEYE_MANIFEST.commands);
  assert.equal((await h.run('open')).ok, true); assert.equal(h.workspace.root.hidden, false);
  assert.equal((await h.run('select_event', { title: 'One' })).ok, true);
  assert.equal((await h.run('preview_time', { offsetMinutes: 15 })).ok, true);
  assert.equal((await h.run('event_sky', { enabled: true })).ok, true);
  assert.equal((await h.run('fly_to_venue')).ok, true);
  assert.deepEqual(h.state.calls, [['select', 'one', false, false], ['preview', 15], ['sky', true, false], ['fly']]);
  assert.equal((await h.run('close')).ok, true); assert.equal(h.workspace.root.hidden, true);
  h.installed.dispose(); assert.equal(h.registry.list().length, 0);
});

test('shell blocks preexisting busy work and Director ownership without changing UI', async () => {
  const h = harness(); h.state.busy = true;
  assert.equal((await h.run('open')).code, 'blocked');
  h.state.busy = false; h.state.allowed = false;
  assert.equal((await h.run('open')).code, 'blocked');
  assert.equal(h.workspace.root.hidden, true); assert.equal(h.state.marked, 0);
  h.installed.dispose();
});

test('manual interaction invalidates delayed local event lookup without selecting', async () => {
  let release;
  const h = harness({ controller: { selectionSnapshot: () => null, listEvents: () => new Promise((r) => { release = r; }) } });
  const pending = h.run('select_event', { title: 'One' });
  h.state.version++; release([{ id: 'one', title: 'One' }]);
  assert.equal((await pending).code, 'cancelled'); assert.deepEqual(h.state.calls, []);
  h.installed.dispose();
});

test('close does not dismiss another panel and denied navigation never reports success', async () => {
  const h = harness({ flyToVenue: () => false });
  await h.panels.show('other', {});
  assert.equal((await h.run('close')).ok, true);
  assert.equal(h.panels.activePanelId, 'other');
  assert.equal((await h.run('fly_to_venue')).ok, false);
  h.installed.dispose();
});

test('duplicate install is refused; disposal cannot remove another registration with the same name', () => {
  const h = harness();
  assert.throws(() => installAstroEyeWorkspaceCommands(h), /already registered/);
  const first = h.registry.get('astroeye_open');
  assert.equal(h.registry.unregister(first.name, { ...first }), false);
  assert.equal(h.registry.unregister(first.name, first), true);
  const replacement = h.registry.register({ ...first, owner: 'replacement' });
  h.installed.dispose(); h.installed.dispose();
  assert.equal(h.registry.get(first.name), replacement);
  assert.equal(h.registry.list().length, 1);
});

test('panel guard cancels delayed mounting and runs owned cleanup without claiming active status', async () => {
  const panels = new PanelRegistry(); let release, current = true, cleaned = 0;
  panels.register({ id: 'slow', owner: 'test', title: 'Slow', mount: async (_host, context) => {
    await new Promise((r) => { release = r; }); assert.equal(context.isCurrent(), false); return () => { cleaned++; };
  } });
  const pending = panels.show('slow', {}, { isCurrent: () => current });
  await new Promise((r) => setImmediate(r)); current = false; release();
  assert.equal(await pending, null); assert.equal(panels.activePanelId, null); assert.equal(cleaned, 1);
});

test('declined panel mount remains retryable and never claims an active panel', async () => {
  const panels = new PanelRegistry(); let accepted = false;
  panels.register({ id: 'maybe', owner: 'test', title: 'Maybe', mount: () => accepted ? (() => {}) : false });
  assert.equal(await panels.show('maybe', {}), null); assert.equal(panels.activePanelId, null);
  accepted = true; await panels.show('maybe', {}); assert.equal(panels.activePanelId, 'maybe');
});

test('newer panel navigation and explicit hide supersede pending mounts', async () => {
  for (const mode of ['newer', 'hide']) {
    const panels = new PanelRegistry(); let release, visible = false, guard;
    panels.register({ id: 'slow', owner: 'test', title: 'Slow', mount: async (_host, { isCurrent }) => {
      guard = isCurrent;
      await new Promise((r) => { release = r; }); if (isCurrent()) visible = true; return () => { visible = false; };
    } });
    panels.register({ id: 'fast', owner: 'test', title: 'Fast', mount: () => {} });
    const pending = panels.show('slow', {}); await new Promise((r) => setImmediate(r));
    await assert.rejects(panels.show('missing', {}), /Unknown panel/);
    assert.equal(guard(), true, 'invalid requests must not cancel valid pending work');
    if (mode === 'newer') await panels.show('fast', {}); else await panels.hide();
    release(); assert.equal(await pending, null); assert.equal(visible, false);
    assert.equal(panels.activePanelId, mode === 'newer' ? 'fast' : null);
  }
});
