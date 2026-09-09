import assert from 'node:assert/strict';
import test from 'node:test';

import { CommandRegistry } from './commandRegistry.js';
import { EventBus } from './eventBus.js';
import { ModuleRegistry } from './moduleRegistry.js';
import { createWorldPlatform } from './platform.js';
import { SourceRegistry } from './sourceRegistry.js';
import { WorldClock } from './worldClock.js';

test('event bus subscriptions are removable and once really means once', () => {
  const bus = new EventBus();
  const seen = [];
  const unsubscribe = bus.on('ping', (value) => seen.push(`on:${value}`));
  bus.once('ping', (value) => seen.push(`once:${value}`));
  assert.equal(bus.emit('ping', 1), 2);
  unsubscribe();
  assert.equal(bus.emit('ping', 2), 0);
  assert.deepEqual(seen, ['on:1', 'once:1']);
});

test('world clock separates moving live time from reproducible event time', () => {
  let current = Date.parse('2026-09-09T12:00:00Z');
  const clock = new WorldClock({ now: () => current });
  assert.equal(clock.nowMs(), current);
  current += 1000;
  assert.equal(clock.nowMs(), current);
  clock.setMode('event', { time: '2026-02-08T23:30:00Z' });
  current += 5000;
  assert.equal(clock.now().toISOString(), '2026-02-08T23:30:00.000Z');
  assert.deepEqual(clock.snapshot(), {
    version: 1,
    mode: 'event',
    time: '2026-02-08T23:30:00.000Z',
  });
});

test('command registry generates both Realtime and bounded local catalogs', async () => {
  const registry = new CommandRegistry();
  registry.register({
    name: 'astroeye_set_event_time',
    description: 'Set the selected AstroEye event time.',
    owner: 'astroeye',
    safeForLocalVoice: true,
    parameters: { type: 'object', properties: { time: { type: 'string' } }, required: ['time'] },
    execute: ({ time }) => time,
  });
  registry.register({
    name: 'research_export_private_workspace',
    description: 'Export a private research workspace.',
    owner: 'research',
    safeForLocalVoice: false,
    execute: () => 'blocked from local voice',
  });
  assert.equal(registry.toRealtimeTools().length, 2);
  assert.deepEqual(registry.toLocalVoiceCatalog().map(({ name }) => name), ['astroeye_set_event_time']);
  assert.equal(await registry.execute('astroeye_set_event_time', { time: 'kickoff' }), 'kickoff');
});

test('source registry rejects incomplete or duplicate license records', () => {
  const sources = new SourceRegistry();
  const source = sources.register({
    id: 'astronomy-engine',
    title: 'Astronomy Engine',
    license: 'MIT',
    attribution: 'Don Cross / Astronomy Engine',
    cachePolicy: 'Calculated locally; no remote response cache.',
  });
  assert.equal(source.license, 'MIT');
  assert.throws(() => sources.register(source), /already registered/);
  assert.throws(() => sources.register({ id: 'unknown' }), /title/);
});

test('module registry validates capabilities and owns one active module', async () => {
  const lifecycle = [];
  const registry = new ModuleRegistry({ context: { worldClock: {} } });
  registry.register({
    id: 'astroeye', title: 'AstroEye', version: '0.1.0',
    capabilitiesRequired: ['worldClock'],
    start: () => lifecycle.push('astroeye:start'),
    stop: () => lifecycle.push('astroeye:stop'),
  });
  registry.register({
    id: 'astrotrace', title: 'AstroTrace', version: '0.1.0',
    capabilitiesRequired: ['worldClock'],
    start: () => lifecycle.push('astrotrace:start'),
  });
  await registry.activate('astroeye');
  await registry.activate('astrotrace');
  assert.equal(registry.activeId, 'astrotrace');
  assert.deepEqual(lifecycle, ['astroeye:start', 'astroeye:stop', 'astrotrace:start']);
});

test('world platform composes one shared context for future modules', () => {
  const platform = createWorldPlatform({ now: () => 1234, context: { viewer: 'later' } });
  assert.equal(platform.worldClock.nowMs(), 1234);
  assert.ok(platform.moduleRegistry);
  assert.ok(platform.commandRegistry);
  assert.ok(platform.sourceRegistry);
});
