/** Read configuration only; never mint a token to probe provider availability. */
export async function readVoiceConfiguration(fetchImpl, { signal, timeoutMs = 5000 } = {}) {
  const abort = new AbortController();
  let timer, cancel;
  const interrupted = new Promise((resolve) => {
    cancel = () => { abort.abort(); resolve(null); };
    signal?.addEventListener('abort', cancel, { once: true });
    timer = setTimeout(cancel, timeoutMs);
    if (signal?.aborted) cancel();
  });
  try {
    if (abort.signal.aborted) return null;
    return await Promise.race([interrupted, (async () => {
      const response = await fetchImpl('/api/openrouter/status', { cache: 'no-store', signal: abort.signal });
      if (!response.ok) return null;
      const value = await response.json();
      if (typeof value?.realtimeConfigured !== 'boolean' || typeof value?.configured !== 'boolean') return null;
      return { realtimeConfigured: value.realtimeConfigured, freeModelConfigured: value.configured };
    })().catch(() => null)]);
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', cancel); }
}

/** Main-shell binding, also exercised with the real controls in isolated QA. */
export function installVoiceFallback({ realtime, freeVoice, document: doc = document, fetchImpl = fetch }) {
  const abort = new AbortController();
  let disposed = false, button = null, click = null, ownsFreeVoice = false;
  const ready = (async () => {
    const configuration = await readVoiceConfiguration(fetchImpl, { signal: abort.signal });
    if (disposed) return 'disposed';
    // Configuration is not an authentication/health verdict. Unknown status
    // leaves the existing transport intact, and never steals an active session.
    if (!configuration) return 'unknown';
    if (configuration.realtimeConfigured || !freeVoice.isSupported() || realtime.isActive()) return 'realtime';
    const old = doc.getElementById('gev-voice-button');
    if (!old || old !== realtime.ui.button || !old.isConnected) return 'unavailable';
    realtime.stop({ preserveStatus: true });
    realtime.unbindPushToTalkShortcut();
    freeVoice.setAiAvailable(configuration.freeModelConfigured);
    button = old.cloneNode(true); old.replaceWith(button);
    ownsFreeVoice = true;
    button.setAttribute('aria-label', 'Browser voice control — click to start or stop');
    const root = doc.getElementById('gev-voice-control');
    root.dataset.transport = 'free';
    const label = doc.getElementById('gev-voice-status');
    const detail = doc.getElementById('gev-voice-detail');
    const error = doc.getElementById('gev-voice-error-detail');
    const help = root.querySelector('.gev-voice-help-detail');
    if (help) help.textContent = 'Click mic to start or stop browser speech';
    const tier = doc.getElementById('gev-voice-tier');
    if (tier) { tier.disabled = true; tier.title = 'Realtime model tier is inactive in browser voice mode'; }
    const cost = doc.getElementById('gev-voice-cost-value');
    if (cost) cost.hidden = true;
    const render = (state, text = '') => {
      if (disposed) return;
      root.dataset.status = state === 'error' ? 'error' : state === 'thinking' ? 'executing'
        : state === 'listening' ? 'listening' : 'idle';
      root.classList.remove('error-dismissed');
      button.setAttribute('aria-pressed', String(freeVoice.isListening()));
      if (label) label.textContent = ({ listening: 'LISTENING', thinking: 'THINKING', heard: 'HEARD', done: 'DONE', error: 'ERROR', idle: 'OFF' })[state] || 'READY';
      if (detail) detail.textContent = text || 'BROWSER VOICE READY';
      if (error) error.textContent = state === 'error' ? text : '';
    };
    freeVoice.onStateChange(render); render('ready');
    click = () => { if (freeVoice.isListening()) freeVoice.stop(); else freeVoice.start(); };
    button.addEventListener('click', click);
    return 'free';
  })();
  return { ready, dispose() {
    if (disposed) return;
    disposed = true; abort.abort();
    if (ownsFreeVoice) {
      button?.removeEventListener('click', click);
      freeVoice.onStateChange(() => {}); freeVoice.stop();
    }
  } };
}
