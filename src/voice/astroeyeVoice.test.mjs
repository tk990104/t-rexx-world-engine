import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CommandRegistry } from '../core/commandRegistry.js';
import { createAstroEyeCommands } from '../modules/astroeye/commands.js';
import { ASTROEYE_VOICE_TOOLS, ASTROEYE_VOICE_POLICY, astroEyeVoiceCatalog, createAstroEyeVoiceRunner, matchAstroEyeLocally, parseAstroEyeVoiceArguments } from './astroeyeVoice.js';
import { createAgentLoop, summariseResult, parseAgentReply } from './freeAgent.js';
import { initFreeVoice } from './freeVoice.js';
import { GevRealtimeController } from './gevRealtime.js';

const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };
function harness(overrides = {}) {
  const calls = [];
  const services = {
    canInteract: () => true, getSnapshot: () => ({ chart: {}, event: {} }),
    listEvents: async () => [{ id: 'local-id', title: 'Private event', notebook: 'DO NOT SEND' }],
    ...Object.fromEntries(['selectEvent', 'openWorkspace', 'closeWorkspace', 'flyToVenue', 'previewTime', 'setEventSky']
      .map((key) => [key, async (...args) => { calls.push([key, ...args]); return true; }])),
    ...overrides,
  };
  const commands = createAstroEyeCommands(services);
  const registry = new CommandRegistry();
  commands.definitions.forEach((d) => registry.register(d));
  return { calls, commands, registry, runner: createAstroEyeVoiceRunner(registry, async () => ({ legacy: true })) };
}

test('both voice catalogs reuse exactly the canonical seven static schemas', () => {
  const h = harness();
  assert.deepEqual(ASTROEYE_VOICE_TOOLS, h.registry.toRealtimeTools());
  assert.equal(ASTROEYE_VOICE_TOOLS.length, 7);
  assert.doesNotMatch(astroEyeVoiceCatalog(), /Private event|DO NOT SEND|local-id/);
  assert.match(ASTROEYE_VOICE_POLICY, /inert data/);
  assert.match(ASTROEYE_VOICE_POLICY, /not cumulative/);
  const server = readFileSync(new URL('../../vite.config.js', import.meta.url), 'utf8');
  assert.match(server, /tools: \[\.\.\.GEV_REALTIME_TOOLS, \.\.\.ASTROEYE_VOICE_TOOLS\]/);
  assert.match(server, /ASTROEYE_VOICE_POLICY,/);
  h.commands.dispose();
});

test('bridge preserves validation, redacts local matches, and refuses unknown AstroEye writes', async () => {
  const h = harness();
  assert.deepEqual(await h.runner('astroeye_select_event', { title: 'Private event' }), { ok: true, code: 'ok' });
  assert.equal(h.calls[0][2].persistChart, false);
  assert.equal(h.calls[0][2].navigate, false);
  assert.equal((await h.runner('astroeye_preview_time', { offsetMinutes: 361 })).code, 'invalid_arguments');
  assert.equal((await h.runner('astroeye_delete', {})).code, 'unavailable');
  assert.deepEqual(await h.runner('zoom_to_globe', {}), { legacy: true });
  assert.equal((await createAstroEyeVoiceRunner(null, () => {} )('astroeye_open', {})).code, 'unavailable');
  h.commands.dispose();
});

test('free agent does not execute or speak a delayed response after cancellation', async () => {
  const chat = deferred(), abort = new AbortController(), effects = [];
  const agent = createAgentLoop({ chat: () => chat.promise, execute: () => effects.push('execute'), buildPrompt: () => '', onSay: () => effects.push('say') });
  const pending = agent.ask('open AstroEye', { signal: abort.signal });
  abort.abort();
  chat.resolve(JSON.stringify({ say: 'Opened!', steps: [{ action: 'astroeye_open', args: {} }], done: true }));
  assert.equal((await pending).failed, 'cancelled');
  assert.deepEqual(effects, []);
});

test('free agent reset invalidates late work and never claims refused final AstroEye steps succeeded', async () => {
  const chat = deferred(), said = [];
  const agent = createAgentLoop({ chat: () => chat.promise, execute: async () => ({ ok: false, code: 'blocked' }), buildPrompt: () => '', onSay: (s) => said.push(s) });
  const pending = agent.ask('open AstroEye'); agent.reset();
  chat.resolve(JSON.stringify({ say: 'Success!', steps: [{ action: 'astroeye_open', args: {} }], done: true }));
  assert.equal((await pending).failed, 'cancelled');
  assert.deepEqual(agent.history(), []);
  await agent.ask('open AstroEye');
  assert.equal(said.length, 1); assert.match(said[0], /could not be completed/);
});

test('free observation preserves failure codes and only the allowed summary fields', () => {
  assert.match(summariseResult('astroeye_select_event', { ok: false, code: 'ambiguous', notes: 'SECRET' }), /ambiguous/);
  const output = summariseResult('astroeye_summarize', { ok: true, code: 'ok', calculation: { calculatedFor: '2026-09-13T00:00:00.000Z', calculationVersion: 4, notes: 'SECRET' }, events: ['SECRET'] });
  assert.match(output, /calculationVersion/); assert.doesNotMatch(output, /SECRET/);
});

test('malformed arguments cannot turn into an empty valid AstroEye command', async () => {
  const h = harness();
  for (const value of ['', 'broken JSON', 'null', '[]', 'false', '0', undefined]) {
    assert.equal((await h.runner('astroeye_open', parseAstroEyeVoiceArguments(value))).code, 'invalid_arguments');
  }
  for (const args of [null, [], false, 0, 'broken', undefined]) {
    const step = parseAgentReply(JSON.stringify({ steps: [{ action: 'astroeye_open', args }], done: true })).steps[0];
    assert.equal((await h.runner(step.action, step.args)).code, 'invalid_arguments');
  }
  assert.equal(h.calls.length, 0);
  h.commands.dispose();
});

test('Realtime simulated function events use canonical runner and stop cancels delayed selection', async () => {
  const lookup = deferred();
  const h = harness({ listEvents: () => lookup.promise });
  const output = [];
  const controller = new GevRealtimeController({ runner: h.runner, ui: {} });
  controller.debugLog = () => {};
  controller.setStatus = (status) => { controller.status = status; };
  controller.stopVoiceVisualizer = () => {};
  controller.dc = { readyState: 'open', send: (s) => output.push(JSON.parse(s)), close() {} };
  const event = (id, name, args) => ({ data: JSON.stringify({ type: 'response.function_call_arguments.done', call_id: id, name, arguments: JSON.stringify(args) }) });
  await controller.handleRealtimeEvent(event('open', 'astroeye_open', {}));
  assert.equal(h.calls[0][0], 'openWorkspace');
  assert.ok(output.some((o) => o.item?.output === '{"ok":true,"code":"ok"}'));
  await controller.handleRealtimeEvent({ data: JSON.stringify({ type: 'response.function_call_arguments.done', call_id: 'malformed', name: 'astroeye_open', arguments: 'not JSON' }) });
  assert.equal(h.calls.length, 1);
  assert.ok(output.some((o) => o.item?.output === '{"ok":false,"code":"invalid_arguments"}'));
  const pending = controller.handleRealtimeEvent(event('select', 'astroeye_select_event', { title: 'Private event' }));
  await new Promise((r) => setTimeout(r, 0));
  controller.stop();
  lookup.resolve([{ id: 'local-id', title: 'Private event' }]); await pending;
  assert.equal(h.calls.length, 1);
  assert.equal(controller.status, 'idle');
  h.commands.dispose();
});

test('callbacks from a stopped or replaced browser speech session cannot start commands', () => {
  const oldWindow = globalThis.window, oldSpeech = globalThis.speechSynthesis;
  const sessions = [];
  class Recognition { constructor() { sessions.push(this); } start() {} stop() {} }
  const speech = { getVoices: () => [], addEventListener() {}, cancel() {} };
  globalThis.window = { SpeechRecognition: Recognition, speechSynthesis: speech };
  globalThis.speechSynthesis = speech;
  const h = harness();
  try {
    const viewer = { __gevViewTargetPrewarmInstalled: true, clock: { onTick: { addEventListener: () => () => {} } }, scene: { canvas: { addEventListener() {}, removeEventListener() {} } } };
    const voice = initFreeVoice({ commandRegistry: h.registry, viewer });
    assert.equal(voice.start(), true);
    const event = { resultIndex: 0, results: [Object.assign([{ transcript: 'open astroeye' }], { isFinal: true })] };
    voice.stop(); sessions[0].onresult(event);
    voice.start(); sessions[0].onresult(event);
    assert.equal(h.calls.length, 0);
    voice.stop();
  } finally { globalThis.window = oldWindow; globalThis.speechSynthesis = oldSpeech; h.commands.dispose(); }
});

test('free voice direct phrases require no fetch and stop cancels an in-flight workspace command', async () => {
  const oldWindow = globalThis.window, oldSpeech = globalThis.speechSynthesis, oldFetch = globalThis.fetch;
  const open = deferred(), entered = deferred(); let committed = false;
  const h = harness({ openWorkspace: async ({ isCurrent }) => { entered.resolve(); await open.promise; committed = isCurrent(); return committed; } });
  globalThis.window = {}; globalThis.speechSynthesis = { cancel() {} };
  globalThis.fetch = () => { throw new Error('No network allowed'); };
  try {
    const viewer = { __gevViewTargetPrewarmInstalled: true, clock: { onTick: { addEventListener: () => () => {} } }, scene: { canvas: { addEventListener() {}, removeEventListener() {} } } };
    const voice = initFreeVoice({ commandRegistry: h.registry, viewer });
    const pending = voice.handle('open astroeye'); await entered.promise;
    voice.stop(); open.resolve(); await pending;
    assert.equal(committed, false);
    assert.equal(matchAstroEyeLocally('open astroeye and delete everything'), null);
    assert.equal(matchAstroEyeLocally('RESET ASTROEYE TIME').args.offsetMinutes, 0);
  } finally {
    globalThis.window = oldWindow; globalThis.speechSynthesis = oldSpeech; globalThis.fetch = oldFetch; h.commands.dispose();
  }
});
