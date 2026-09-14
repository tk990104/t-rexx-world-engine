import test from 'node:test';
import assert from 'node:assert/strict';
import { closeOwnedBrowser } from './qa-owned-browser-cleanup.mjs';

function fixture() {
  const calls = [];
  const process = { exitCode: null, signalCode: null, kill() { calls.push('kill'); return true; } };
  const browser = { process: () => process, async close() { calls.push('browser'); process.exitCode = 0; } };
  const page = { browser: () => browser, isClosed: () => false,
    async close(options) { assert.deepEqual(options, { runBeforeUnload: false }); calls.push('page'); } };
  return { calls, process, browser, page };
}
const short = { pageTimeoutMs: 10, closeTimeoutMs: 10 };
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
