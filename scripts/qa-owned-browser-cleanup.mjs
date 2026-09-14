// Only for browsers launched and owned by a QA harness, never attached sessions.
const exited = (process) => process.exitCode != null || process.signalCode != null;
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
export async function closeOwnedBrowser(browser, { page, pageTimeoutMs = 3000, closeTimeoutMs = 10000 } = {}) {
  for (const value of [pageTimeoutMs, closeTimeoutMs]) {
    if (!Number.isInteger(value) || value < 1 || value > 10000) throw new RangeError('Cleanup timeouts must be 1–10000 ms');
  }
  const process = browser?.process();
  if (!process) return { status: 'not-owned', forced: false };
  if (page && page.browser() !== browser) throw new Error('Cleanup page belongs to another browser');
  const started = Date.now();
  // Skip beforeunload prompts only in this disposable synthetic-data profile.
  const pageClose = page && !page.isClosed()
    ? await bounded(() => page.close({ runBeforeUnload: false }), pageTimeoutMs) : 'not-needed';
  const browserClose = await bounded(() => browser.close(), closeTimeoutMs);
  const processExited = exited(process);
  const result = { status: browserClose === 'completed' && processExited ? 'graceful'
    : processExited ? 'process-exited-cleanup-incomplete' : 'process-still-running',
    pageClose, browserClose, processExited, forced: false, elapsedMs: Date.now() - started };
  if (!processExited) {
    // Never enumerate or terminate other Chrome/Codex processes.
    try { result.forced = process.kill() === true; }
    catch { result.killFailed = true; }
  }
  return result;
}
