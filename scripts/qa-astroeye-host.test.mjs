import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inspectHostFeatures, inspectHostAccessibility, mountAccessibilityCheck } from '../public/qa/astroeye-host.mjs';

function fixture() {
  let releases = 0;
  const forbidden = () => assert.fail('Probe must not access services or stored data');
  const gl = { isContextLost: () => false, getExtension: () => ({ loseContext() { releases++; } }) };
  const surface = { isSecureContext: true, document: { createElement: () => ({ getContext: () => gl }) },
    Intl, indexedDB: { open: forbidden, deleteDatabase: forbidden }, RTCPeerConnection: forbidden,
    navigator: { mediaDevices: { getUserMedia: forbidden }, permissions: { query: forbidden } },
    SpeechRecognition: forbidden, SpeechSynthesisUtterance: forbidden,
    speechSynthesis: { speak: forbidden, cancel: forbidden, getVoices: forbidden, addEventListener: forbidden }, fetch: forbidden,
    localStorage: { getItem: forbidden, setItem: forbidden }, sessionStorage: { getItem: forbidden } };
  return { surface, gl, releases: () => releases };
}
test('detects eight prerequisites without invoking sensitive APIs and releases graphics', () => {
  const f = fixture(), report = inspectHostFeatures(f.surface);
  assert.equal(report.checks.length, 8);
  assert.ok(report.checks.every((check) => check.result === 'detected'));
  assert.equal(report.scope, 'prerequisites-only'); assert.equal(f.releases(), 1);
});
test('missing or blocked features are reported independently without raw errors', () => {
  const f = fixture(); f.surface.isSecureContext = false;
  f.surface.SpeechRecognition = undefined;
  Object.defineProperty(f.surface, 'indexedDB', { get() { throw new Error('private-sentinel'); } });
  const report = inspectHostFeatures(f.surface);
  assert.equal(report.checks.find((x) => x.id === 'secure-context').result, 'not-detected');
  assert.equal(report.checks.find((x) => x.id === 'recognition-api').result, 'not-detected');
  assert.equal(report.checks.find((x) => x.id === 'storage-api').result, 'unavailable');
  assert.doesNotMatch(JSON.stringify(report), /private-sentinel/);
});
test('graphics fallback, missing context and lost contexts are truthful', () => {
  const f = fixture(), requests = [];
  f.surface.document.createElement = () => ({ getContext(type) { requests.push(type); return type === 'webgl' ? f.gl : null; } });
  assert.equal(inspectHostFeatures(f.surface).checks[1].result, 'detected');
  assert.deepEqual(requests, ['webgl2', 'webgl']);
  f.gl.isContextLost = () => true;
  assert.equal(inspectHostFeatures(f.surface).checks[1].result, 'not-detected');
  assert.equal(f.releases(), 2);
  f.surface.document.createElement = () => ({ getContext: () => null });
  assert.equal(inspectHostFeatures(f.surface).checks[1].result, 'not-detected');
});
test('recognition prefix works, unavailable Intl is isolated, reports exclude identity', () => {
  const f = fixture(); f.surface.webkitSpeechRecognition = f.surface.SpeechRecognition;
  delete f.surface.SpeechRecognition; f.surface.Intl = undefined;
  f.surface.navigator.userAgent = 'private-agent'; f.surface.location = { href: 'private-url' };
  const report = inspectHostFeatures(f.surface);
  assert.equal(report.checks.find((x) => x.id === 'recognition-api').result, 'detected');
  assert.equal(report.checks.find((x) => x.id === 'named-time-zones').result, 'unavailable');
  assert.doesNotMatch(JSON.stringify(report), /private-agent|private-url/);
});
test('partial speech-output surfaces do not count as complete prerequisites', () => {
  const f = fixture(); delete f.surface.speechSynthesis.addEventListener;
  assert.equal(inspectHostFeatures(f.surface).checks.find((x) => x.id === 'speech-output-api').result, 'not-detected');
});

test('motion snapshots distinguish reduce and no preference without invoking sensitive APIs', () => {
  const f = fixture();
  for (const reduced of [true, false]) {
    const queries = [];
    f.surface.matchMedia = (query) => {
      queries.push(query);
      return { matches: query.endsWith(': reduce)') ? reduced : !reduced,
        addEventListener() { assert.fail('Snapshots must not install listeners'); } };
    };
    const report = inspectHostAccessibility(f.surface);
    assert.deepEqual(queries, ['(prefers-reduced-motion: reduce)', '(prefers-reduced-motion: no-preference)']);
    assert.deepEqual(report, { schema: 'trexx-host-accessibility-v1', scope: 'preference-snapshot-only',
      motionPreference: reduced ? 'reduce' : 'no-preference', screenReaderSpeech: 'not-verified', appCameraBehavior: 'not-verified' });
  }
  assert.equal(f.releases(), 0, 'accessibility checks need no graphics context');
});

test('missing, rejected, contradictory and malformed preference responses remain unavailable', () => {
  const cases = [undefined, () => { throw new Error('private-sentinel'); },
    () => ({ matches: false }), () => ({ matches: true }), () => null, () => ({ matches: 'true' })];
  for (const matchMedia of cases) {
    const report = inspectHostAccessibility({ matchMedia });
    assert.equal(report.motionPreference, 'unavailable');
    assert.doesNotMatch(JSON.stringify(report), /private-sentinel/);
  }
});

function accessibilityDocument() {
  const nodes = new Map();
  for (const id of ['read-motion', 'motion-status', 'accessibility-report', 'accessibility-results',
    'announce-running', 'announce-stopped', 'announcement-sample']) {
    const listeners = new Map();
    nodes.set(id, { textContent: '', value: '', hidden: true,
      addEventListener: (type, handler) => listeners.set(type, handler),
      removeEventListener: (type, handler) => { if (listeners.get(type) === handler) listeners.delete(type); },
      click: () => listeners.get('click')?.() });
  }
  return { getElementById: (id) => nodes.get(id) };
}

test('mount is silent; explicit reads resample; sample announcements never certify speech', () => {
  const document = accessibilityDocument();
  const node = (id) => document.getElementById(id);
  let reads = 0, reduced = true;
  const f = fixture();
  f.surface.matchMedia = (query) => { reads++; return { matches: query.endsWith(': reduce)') ? reduced : !reduced }; };
  const cleanup = mountAccessibilityCheck(document, f.surface);
  assert.equal(reads, 0);
  assert.equal(node('accessibility-results').hidden, true);
  assert.equal(node('announcement-sample').textContent, '');
  node('read-motion').click();
  assert.equal(node('accessibility-results').hidden, false);
  assert.equal(JSON.parse(node('accessibility-report').value).motionPreference, 'reduce');
  reduced = false;
  node('read-motion').click();
  assert.equal(reads, 4);
  assert.match(node('motion-status').textContent, /no reduced-motion preference/);
  node('announce-running').click();
  assert.match(node('announcement-sample').textContent, /Sample only:.*running.*No tour has started/);
  node('announce-stopped').click();
  assert.match(node('announcement-sample').textContent, /Sample only:.*stopped.*No tour was running/);
  assert.equal(reads, 4);
  assert.equal(JSON.parse(node('accessibility-report').value).screenReaderSpeech, 'not-verified');
  cleanup();
  node('read-motion').click(); node('announce-running').click();
  assert.equal(reads, 4);
  assert.match(node('announcement-sample').textContent, /stopped/);
});

test('mount presents unavailable preference without leaking an exception', () => {
  const document = accessibilityDocument();
  mountAccessibilityCheck(document, {});
  document.getElementById('read-motion').click();
  assert.match(document.getElementById('motion-status').textContent, /could not report/);
  assert.equal(JSON.parse(document.getElementById('accessibility-report').value).motionPreference, 'unavailable');
});

test('accessibility page keeps fixed polite regions, explicit buttons and restrictive CSP', () => {
  const html = readFileSync(new URL('../public/qa/astroeye-host.html', import.meta.url), 'utf8');
  assert.match(html, /connect-src 'none'/);
  for (const id of ['motion-status', 'announcement-sample']) {
    assert.match(html, new RegExp(`id="${id}" role="status" aria-live="polite" aria-atomic="true"`));
  }
  for (const id of ['read-motion', 'announce-running', 'announce-stopped']) {
    assert.match(html, new RegExp(`id="${id}" type="button"`));
  }
  assert.match(html, /id="accessibility-results" hidden/);
  assert.match(html, /id="accessibility-report"[^>]*readonly/);
  assert.match(html, /A visible message is not proof that speech was heard/);
  assert.doesNotMatch(html, /autofocus|onload=|onclick=/);
});
