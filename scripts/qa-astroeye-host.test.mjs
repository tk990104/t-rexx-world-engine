import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectHostFeatures } from '../public/qa/astroeye-host.mjs';

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
