export const RENDER_CHECK_MS = 10000;

function counters(value) {
  const count = (number) => Number.isSafeInteger(number) && number >= 0 ? number : null;
  return {
    governorMode: ['idle', 'continuous'].includes(value?.governorMode) ? value.governorMode : 'unknown',
    continuousHolds: count(value?.continuousHolds),
    eventSkyEnabled: typeof value?.eventSkyEnabled === 'boolean' ? value.eventSkyEnabled : null,
    ephemerisUpdates: count(value?.ephemerisUpdates),
  };
}

/** Passive, bounded observer. No frame requests, storage, network or clock writes. */
export function createRenderCheck({ postRender, readCounters, document,
  now = () => performance.now(), schedule = setTimeout, unschedule = clearTimeout } = {}) {
  let active = null, disposed = false;
  return Object.freeze({
    start() {
      if (disposed) throw new Error('Render check has been disposed.');
      if (active) throw new Error('A render check is already running.');
      if (document.hidden) throw new Error('Keep this tab visible before starting.');
      const before = counters(readCounters()), started = now();
      let frames = 0, timer, removeFrame;
      const removers = [];
      let resolveResult;
      const result = new Promise((resolve) => { resolveResult = resolve; });
      const finish = (reason) => {
        if (active !== finish) return;
        active = null;
        unschedule(timer); removeFrame?.(); removers.forEach((off) => off());
        const elapsedMs = Math.max(0, now() - started);
        let after;
        try { after = counters(readCounters()); }
        catch { reason = 'counter-read-failed'; }
        if (reason === 'completed' && (elapsedMs < RENDER_CHECK_MS || elapsedMs > RENDER_CHECK_MS + 5000)) reason = 'timer-outside-window';
        resolveResult({ schema: 'trexx-render-check-v1', scope: 'passive-scene-observation',
          status: reason === 'completed' ? 'completed' : 'incomplete', reason,
          requestedMs: RENDER_CHECK_MS, elapsedMs: Math.round(elapsedMs), renderedFrames: frames,
          before, after: after ?? null,
          ephemerisUpdateDelta: before.ephemerisUpdates !== null && after?.ephemerisUpdates != null
            && after.ephemerisUpdates >= before.ephemerisUpdates ? after.ephemerisUpdates - before.ephemerisUpdates : null,
          acceptance: 'observation-only; not GPU time, maximum FPS, chart latency or release acceptance' });
      };
      active = finish;
      try {
        removeFrame = postRender.addEventListener(() => { frames++; });
        const listen = (name, callback) => {
          document.addEventListener(name, callback, true);
          removers.push(() => document.removeEventListener(name, callback, true));
        };
        listen('visibilitychange', () => { if (document.hidden) finish('tab-hidden'); });
        for (const name of ['pointerdown', 'keydown', 'wheel']) listen(name, () => finish('interaction'));
        timer = schedule(() => finish('completed'), RENDER_CHECK_MS);
      } catch {
        finish('observer-unavailable');
      }
      return result;
    },
    cancel() { active?.('cancelled'); },
    destroy() { disposed = true; active?.('disposed'); },
  });
}
