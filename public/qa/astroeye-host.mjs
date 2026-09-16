/** Feature probes only. Never open storage, construct speech/RTC sessions, query
 * permissions or call a provider. Caller supplies the browser surface for tests. */
export function inspectHostFeatures(surface) {
  const checks = [];
  const add = (id, label, probe) => {
    let result;
    try { result = probe() ? 'detected' : 'not-detected'; }
    catch { result = 'unavailable'; }
    checks.push({ id, label, result });
  };
  add('secure-context', 'Secure browser context', () => surface.isSecureContext === true);
  add('graphics', 'WebGL graphics context', () => {
    const canvas = surface.document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return false;
    try { return !gl.isContextLost(); }
    finally { gl.getExtension('WEBGL_lose_context')?.loseContext(); }
  });
  add('storage-api', 'IndexedDB API (persistence not tested)', () => typeof surface.indexedDB?.open === 'function');
  add('named-time-zones', 'Named time-zone formatting', () => {
    const formatter = new surface.Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric' });
    return formatter.resolvedOptions().timeZone === 'America/New_York'
      && formatter.formatToParts(new Date('2000-01-01T12:00:00Z')).some((part) => part.type === 'year' && part.value === '2000');
  });
  add('rtc-api', 'WebRTC API (connection not tested)', () => typeof surface.RTCPeerConnection === 'function');
  add('capture-api', 'Microphone API (permission not requested)', () => typeof surface.navigator?.mediaDevices?.getUserMedia === 'function');
  add('recognition-api', 'Speech-recognition API (not started)', () =>
    typeof surface.SpeechRecognition === 'function' || typeof surface.webkitSpeechRecognition === 'function');
  add('speech-output-api', 'Speech-output API (not played)', () => typeof surface.SpeechSynthesisUtterance === 'function'
    && ['speak', 'cancel', 'getVoices', 'addEventListener'].every((method) => typeof surface.speechSynthesis?.[method] === 'function'));
  return { schema: 'trexx-host-features-v1', scope: 'prerequisites-only', checks };
}

/** Explicit snapshot only: no listeners, settings changes or inferred speech support. */
export function inspectHostAccessibility(surface) {
  let motionPreference = 'unavailable';
  try {
    const reduce = surface.matchMedia('(prefers-reduced-motion: reduce)');
    const normal = surface.matchMedia('(prefers-reduced-motion: no-preference)');
    if (reduce.matches === true && normal.matches === false) motionPreference = 'reduce';
    if (reduce.matches === false && normal.matches === true) motionPreference = 'no-preference';
  } catch { /* Report an unknown preference without exposing host errors. */ }
  return { schema: 'trexx-host-accessibility-v1', scope: 'preference-snapshot-only',
    motionPreference, screenReaderSpeech: 'not-verified', appCameraBehavior: 'not-verified' };
}

export function mountAccessibilityCheck(document, surface) {
  const bindings = [];
  const bind = (id, handler) => {
    const button = document.getElementById(id);
    button?.addEventListener('click', handler);
    if (button) bindings.push(() => button.removeEventListener('click', handler));
  };
  bind('read-motion', () => {
    const report = inspectHostAccessibility(surface);
    const descriptions = {
      reduce: 'This browser currently requests reduced motion.',
      'no-preference': 'This browser currently reports no reduced-motion preference.',
      unavailable: 'This browser could not report a definite motion preference.',
    };
    document.getElementById('motion-status').textContent = descriptions[report.motionPreference]
      + ' This is a snapshot, not a camera test. Read again after any preference change.';
    document.getElementById('accessibility-report').value = JSON.stringify(report, null, 2);
    document.getElementById('accessibility-results').hidden = false;
  });
  bind('announce-running', () => {
    document.getElementById('announcement-sample').textContent = 'Sample only: scene playback is running. No tour has started.';
  });
  bind('announce-stopped', () => {
    document.getElementById('announcement-sample').textContent = 'Sample only: scene playback has stopped. No tour was running.';
  });
  return () => bindings.forEach((remove) => remove());
}

export function mountHostCheck(document, surface) {
  const button = document.getElementById('run');
  const run = () => {
    const report = inspectHostFeatures(surface);
    const list = document.getElementById('checks');
    list.replaceChildren();
    for (const check of report.checks) {
      const row = document.createElement('li');
      const label = document.createElement('strong'); label.textContent = check.label;
      row.append(label, document.createTextNode(check.result === 'detected' ? 'Detected'
        : check.result === 'not-detected' ? 'Not detected' : 'Unavailable to this check'));
      list.append(row);
    }
    document.getElementById('report').value = JSON.stringify(report, null, 2);
    document.getElementById('results').hidden = false;
    document.getElementById('status').textContent = 'Local checks complete. No microphone, provider or saved-data access was requested.';
  };
  button.addEventListener('click', run);
  return () => button.removeEventListener('click', run);
}
if (typeof window !== 'undefined' && document.getElementById('run')) {
  mountHostCheck(document, window);
  mountAccessibilityCheck(document, window);
}
