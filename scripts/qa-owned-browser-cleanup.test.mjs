import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { closeOwnedBrowser } from './qa-owned-browser-cleanup.mjs';

function fixture() {
  const calls = [];
  const process = Object.assign(new EventEmitter(), { exitCode: null, signalCode: null, kill() { calls.push('kill'); return true; } });
  const browser = Object.assign(new EventEmitter(), { process: () => process, async close() { calls.push('browser'); process.exitCode = 0; } });
  const page = { browser: () => browser, isClosed: () => false,
    async close(options) { assert.deepEqual(options, { runBeforeUnload: false }); calls.push('page'); } };
  return { calls, process, browser, page };
}
const short = { pageTimeoutMs: 10, closeTimeoutMs: 10, forceExitTimeoutMs: 20 };
test('closes the owned page before browser and confirms process exit', async () => {
  const f = fixture();
  const result = await closeOwnedBrowser(f.browser, { page: f.page, ...short });
  assert.equal(result.status, 'graceful'); assert.equal(result.forced, false);
  assert.deepEqual(f.calls, ['page', 'browser']);
});
test('slow profile cleanup after process exit is not falsely reported as a kill', async () => {
  const f = fixture();
  f.browser.close = () => { f.process.exitCode = 0; return new Promise(() => {}); };
  const result = await closeOwnedBrowser(f.browser, short);
  assert.equal(result.status, 'process-exited-cleanup-incomplete');
  assert.equal(result.browserClose, 'timeout'); assert.equal(result.forced, false);
  assert.deepEqual(f.calls, []);
});
test('hung page and browser stay bounded and target only the owned process', async () => {
  const f = fixture();
  f.page.close = f.browser.close = () => new Promise(() => {});
  const result = await closeOwnedBrowser(f.browser, { page: f.page, ...short });
  assert.equal(result.pageClose, 'timeout'); assert.equal(result.browserClose, 'timeout');
  assert.equal(result.status, 'process-still-running'); assert.equal(result.forced, true);
  assert.deepEqual(f.calls, ['kill']);
  assert.equal(result.forcedExit, 'timeout');
  assert.equal(result.processExitedAfterCleanup, false);
  assert.equal(f.process.listenerCount('exit'), 0);
  assert.equal(f.browser.listenerCount('disconnected'), 0);
});
test('rejection after process exit is cleanup failure, never graceful or forced', async () => {
  const f = fixture();
  f.browser.close = async () => { f.process.signalCode = 'SIGTERM'; throw new Error('cleanup'); };
  const result = await closeOwnedBrowser(f.browser, short);
  assert.equal(result.status, 'process-exited-cleanup-incomplete');
  assert.equal(result.browserClose, 'failed'); assert.equal(result.forced, false);
});
test('does not operate on attached browsers or a page from another browser', async () => {
  assert.deepEqual(await closeOwnedBrowser({ process: () => null, close() { assert.fail('borrowed'); } }),
    { status: 'not-owned', forced: false });
  const f = fixture(); f.page.browser = () => ({});
  await assert.rejects(closeOwnedBrowser(f.browser, { page: f.page }), /another browser/);
  assert.deepEqual(f.calls, []);
});
test('invalid bounds are refused and a failed kill is reported honestly', async () => {
  const f = fixture();
  await assert.rejects(closeOwnedBrowser(f.browser, { closeTimeoutMs: 10001 }), RangeError);
  f.browser.close = async () => { throw new Error('close'); };
  f.process.kill = () => { throw new Error('kill'); };
  const result = await closeOwnedBrowser(f.browser, short);
  assert.equal(result.forced, false); assert.equal(result.killFailed, true);
  assert.equal(result.status, 'process-still-running');
});

test('records disconnect and exit separately and removes all owned listeners', async () => {
  const f = fixture();
  f.browser.close = async () => {
    f.browser.emit('disconnected'); f.process.exitCode = 0; f.process.emit('exit', 0);
  };
  const result = await closeOwnedBrowser(f.browser, short);
  assert.equal(result.status, 'graceful'); assert.equal(result.forcedExit, 'not-requested');
  for (const value of Object.values(result.stages)) assert.ok(Number.isFinite(value) && value >= 0);
  assert.equal(result.processExitedAfterCleanup, true);
  assert.equal(f.process.listenerCount('exit'), 0); assert.equal(f.browser.listenerCount('disconnected'), 0);
});

test('a confirmed forced exit is still a failed graceful shutdown, not profile-cleanup evidence', async () => {
  const f = fixture();
  f.browser.close = async () => { throw new Error('close'); };
  f.process.kill = () => {
    setImmediate(() => { f.process.signalCode = 'SIGTERM'; f.process.emit('exit', null, 'SIGTERM'); });
    return true;
  };
  const result = await closeOwnedBrowser(f.browser, short);
  assert.equal(result.status, 'process-still-running'); assert.equal(result.processExited, false);
  assert.equal(result.browserClose, 'failed'); assert.equal(result.forced, true);
  assert.equal(result.forcedExit, 'observed'); assert.equal(result.processExitedAfterCleanup, true);
  assert.equal(f.process.listenerCount('exit'), 0);
});

test('already-completed forced exit is observed without a second signal', async () => {
  const f = fixture();
  f.browser.close = async () => { throw new Error('close'); };
  f.process.kill = () => { f.calls.push('kill'); f.process.exitCode = 1; return true; };
  const result = await closeOwnedBrowser(f.browser, short);
  assert.equal(result.forcedExit, 'observed'); assert.deepEqual(f.calls, ['kill']);
});

test('a refused termination does not claim an observed exit or retain listeners', async () => {
  const f = fixture();
  f.browser.close = async () => { throw new Error('close'); }; f.process.kill = () => false;
  const result = await closeOwnedBrowser(f.browser, short);
  assert.equal(result.forced, false); assert.equal(result.forcedExit, 'not-requested');
  assert.equal(result.processExitedAfterCleanup, false);
  assert.equal(f.process.listenerCount('exit'), 0); assert.equal(f.browser.listenerCount('disconnected'), 0);
});

test('invalid forced-exit bounds fail before any browser action', async () => {
  for (const forceExitTimeoutMs of [0, -1, 1001, 1.5, NaN]) {
    const f = fixture();
    await assert.rejects(closeOwnedBrowser(f.browser, { forceExitTimeoutMs }), RangeError);
    assert.deepEqual(f.calls, []); assert.equal(f.process.listenerCount('exit'), 0);
  }
});

test('removable browser listeners do not depend on once wrappers or remove other observers', async () => {
  const f = fixture();
  const observer = () => {};
  f.browser.on('disconnected', observer); f.process.on('exit', observer);
  f.browser.once = () => assert.fail('Puppeteer once wrappers cannot be removed by the original handler');
  f.browser.close = () => new Promise(() => {});
  await closeOwnedBrowser(f.browser, short);
  assert.deepEqual(f.browser.listeners('disconnected'), [observer]);
  assert.deepEqual(f.process.listeners('exit'), [observer]);
});
