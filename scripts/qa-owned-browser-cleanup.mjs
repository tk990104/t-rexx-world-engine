// Only for browsers launched and owned by a QA harness, never attached sessions.
const exited = (process) => process.exitCode != null || process.signalCode != null;
function observeExit(process, timeoutMs) {
  if (exited(process)) return Promise.resolve('observed');
  return new Promise(resolve => {
    const finish = (outcome) => {
      clearTimeout(timer); process.removeListener('exit', onExit); resolve(outcome);
    };
    const onExit = () => finish('observed');
    const timer = setTimeout(() => finish(exited(process) ? 'observed' : 'timeout'), timeoutMs);
    process.once('exit', onExit);
  });
}
async function bounded(action, timeoutMs) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(action).then(() => 'completed', () => 'failed'),
      new Promise((resolve) => { timer = setTimeout(() => resolve('timeout'), timeoutMs); }),
    ]);
  } finally { clearTimeout(timer); }
}

/** A resolved browser.close also includes Puppeteer's profile-cleanup hook.
 * Report it separately from process exit; never kill an already-exited process.
 * The returned outcome is evidence, not permission to call a timeout a clean exit. */
export async function closeOwnedBrowser(browser, { page, pageTimeoutMs = 3000, closeTimeoutMs = 10000, forceExitTimeoutMs = 1000 } = {}) {
  for (const value of [pageTimeoutMs, closeTimeoutMs]) {
    if (!Number.isInteger(value) || value < 1 || value > 10000) throw new RangeError('Cleanup timeouts must be 1–10000 ms');
  }
  if (!Number.isInteger(forceExitTimeoutMs) || forceExitTimeoutMs < 1 || forceExitTimeoutMs > 1000) {
    throw new RangeError('Forced-exit observation must be 1–1000 ms');
  }
  const process = browser?.process();
  if (!process) return { status: 'not-owned', forced: false };
  if (page && page.browser() !== browser) throw new Error('Cleanup page belongs to another browser');
  const started = Date.now();
  const stages = { pageCloseMs: null, browserCloseMs: null, disconnectedAtMs: null, processExitAtMs: exited(process) ? 0 : null };
  const disconnected = () => { stages.disconnectedAtMs ??= Date.now() - started; };
  const processExit = () => { stages.processExitAtMs = Date.now() - started; };
  // Puppeteer's once() wraps handlers; on/off keeps our listener removable even
  // when a stuck browser never emits the event.
  browser.on?.('disconnected', disconnected);
  process.once('exit', processExit);
  try {
    // Skip beforeunload prompts only in this disposable synthetic-data profile.
    const pageClose = page && !page.isClosed()
      ? await bounded(() => page.close({ runBeforeUnload: false }), pageTimeoutMs) : 'not-needed';
    stages.pageCloseMs = Date.now() - started;
    const browserStarted = Date.now();
    const browserClose = await bounded(() => browser.close(), closeTimeoutMs);
    stages.browserCloseMs = Date.now() - browserStarted;
    const processExited = exited(process);
    const result = { status: browserClose === 'completed' && processExited ? 'graceful'
      : processExited ? 'process-exited-cleanup-incomplete' : 'process-still-running',
      pageClose, browserClose, processExited, forced: false, forcedExit: 'not-requested', stages };
    if (!processExited) {
      // Never enumerate or terminate other Chrome/Codex processes.
      try { result.forced = process.kill() === true; }
      catch { result.killFailed = true; }
      if (result.forced) result.forcedExit = await observeExit(process, forceExitTimeoutMs);
    }
    // Preserve the pre-fallback status: forced exit is never graceful cleanup and
    // does not establish that Puppeteer's temporary-profile cleanup completed.
    result.processExitedAfterCleanup = exited(process);
    result.elapsedMs = Date.now() - started;
    return result;
  } finally {
    browser.off?.('disconnected', disconnected);
    process.removeListener('exit', processExit);
  }
}
