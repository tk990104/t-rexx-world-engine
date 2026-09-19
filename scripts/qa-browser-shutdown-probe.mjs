import puppeteer from 'puppeteer';
import { closeOwnedBrowser } from './qa-owned-browser-cleanup.mjs';

// A blank, freshly launched profile only. Never attach to a user's browser.
const pipe = process.argv.includes('--pipe');
let browser, page;
const started = Date.now(), events = [];
const watchdog = setTimeout(() => {
  browser?.process()?.kill();
  process.stderr.write('Blank-browser shutdown probe exceeded 45 seconds.\n');
  process.exit(1);
}, 45000);
let cleanup, version;
try {
  browser = await puppeteer.launch({ headless: true, pipe, timeout: 15000,
    args: ['--disable-background-networking'] });
  const child = browser.process();
  const record = name => events.push({ name, elapsedMs: Date.now() - started });
  child.once('exit', () => record('process-exit'));
  child.once('close', () => record('stdio-close'));
  browser.once('disconnected', () => record('disconnected'));
  version = await browser.version();
  page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on('request', request => void request.abort());
  record('ready');
} finally {
  try {
    cleanup = await closeOwnedBrowser(browser, { page });
  } finally { clearTimeout(watchdog); }
}
const child = browser?.process();
const report = { transport: pipe ? 'pipe' : 'websocket', version, events, cleanup,
  exitObservedAfterCleanup: child?.exitCode != null || child?.signalCode != null,
  appLoaded: false, userProfileAccessed: false };
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`, () => process.exit(cleanup.status === 'graceful' ? 0 : 1));
