import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import puppeteer from 'puppeteer';
import { closeOwnedBrowser } from './qa-owned-browser-cleanup.mjs';

let browser, page, server, report;
const watchdog = setTimeout(() => { browser?.process()?.kill(); process.exit(1); }, 60000);
try {
  const files = new Map(await Promise.all([
    ['html', 'text/html'], ['mjs', 'application/javascript'], ['css', 'text/css'],
  ].map(async ([extension, type]) => [`/qa/astroeye-host.${extension}`, {
    type, body: await readFile(new URL(`../public/qa/astroeye-host.${extension}`, import.meta.url)),
  }])));
  const unexpected = [];
  server = createServer((req, res) => {
    const file = files.get(req.url);
    if (!file) {
      if (req.url !== '/favicon.ico') unexpected.push('unexpected-local-request');
      res.writeHead(404); res.end(); return;
    }
    res.writeHead(200, { 'Content-Type': file.type, 'Cache-Control': 'no-store',
      'Permissions-Policy': 'microphone=(), camera=(), geolocation=()' });
    res.end(file.body);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await puppeteer.launch({ headless: true, timeout: 15000,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-background-networking'] });
  page = await browser.newPage(); page.setDefaultTimeout(10000);
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    if (new URL(req.url()).origin !== origin) { unexpected.push('external-request'); void req.abort(); }
    else void req.continue();
  });
  const errors = []; page.on('pageerror', (error) => errors.push(error.name));
  await page.evaluateOnNewDocument(() => {
    window.__forbiddenCalls = 0;
    const denied = () => { window.__forbiddenCalls++; throw new Error('Not allowed in feature probe'); };
    // Preserve capability presence while proving no service/storage operation occurs.
    window.fetch = denied;
    if (window.indexedDB) { indexedDB.open = denied; indexedDB.deleteDatabase = denied; }
    if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = denied;
    if (navigator.permissions) navigator.permissions.query = denied;
    if (window.speechSynthesis) speechSynthesis.speak = denied;
    if (window.RTCPeerConnection) window.RTCPeerConnection = denied;
    if (window.SpeechRecognition) window.SpeechRecognition = denied;
    if (window.webkitSpeechRecognition) window.webkitSpeechRecognition = denied;
    Storage.prototype.getItem = denied; Storage.prototype.setItem = denied;
  });
  await page.goto(`${origin}/qa/astroeye-host.html`, { waitUntil: 'networkidle0' });
  assert.equal(await page.$eval('#results', (node) => node.hidden), true);
  assert.equal(await page.$eval('#checks', (node) => node.children.length), 0);
  await page.focus('#run'); await page.keyboard.press('Enter');
  await page.waitForFunction(() => !document.getElementById('results').hidden);
  const contents = await page.$eval('#report', (node) => node.value);
  const features = JSON.parse(contents);
  assert.equal(features.checks.length, 8);
  assert.equal(features.scope, 'prerequisites-only');
  assert.equal(await page.$eval('#checks', (node) => node.children.length), 8);
  assert.equal(await page.evaluate(() => window.__forbiddenCalls), 0);
  await page.click('#run');
  assert.equal(await page.$eval('#report', (node) => node.value), contents);
  await page.setViewport({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  assert.equal(await page.$eval('#report', (node) => node.readOnly), true);
  assert.deepEqual(errors, []); assert.deepEqual(unexpected, []);
  report = { passed: true, checks: 8, keyboardActivation: true, narrowLayout: true,
    sensitiveOperations: 0, externalRequests: 0, embeddedHostVerified: false,
    browser: await browser.version() };
} finally {
  try {
    const cleanup = await closeOwnedBrowser(browser, { page });
    if (report) report.cleanup = cleanup;
  } finally { server?.closeAllConnections(); server?.close(); clearTimeout(watchdog); }
}
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`, () => process.exit(report?.passed && report?.cleanup.status === 'graceful' ? 0 : 1));
