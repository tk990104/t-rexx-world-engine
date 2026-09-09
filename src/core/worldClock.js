export const WORLD_CLOCK_MODES = Object.freeze(['live', 'event', 'replay']);

function finiteTime(value, label = 'time') {
  const time = value instanceof Date
    ? value.getTime()
    : typeof value === 'string'
      ? Date.parse(value)
      : Number(value);
  if (!Number.isFinite(time)) throw new TypeError(`${label} must be a finite timestamp`);
  return time;
}

/** One time authority for live feeds, AstroEye charts, research, and scenes. */
export class WorldClock {
  #mode = 'live';
  #fixedTimeMs = null;
  #now;
  #events;

  constructor({ now = Date.now, eventBus = null } = {}) {
    if (typeof now !== 'function') throw new TypeError('now must be a function');
    this.#now = now;
    this.#events = eventBus;
  }

  get mode() {
    return this.#mode;
  }

  nowMs() {
    return this.#mode === 'live' ? finiteTime(this.#now(), 'live clock') : this.#fixedTimeMs;
  }

  now() {
    return new Date(this.nowMs());
  }

  setMode(mode, { time = this.#now() } = {}) {
    if (!WORLD_CLOCK_MODES.includes(mode)) {
      throw new RangeError(`Unknown world clock mode: ${mode}`);
    }
    this.#mode = mode;
    this.#fixedTimeMs = mode === 'live' ? null : finiteTime(time);
    const snapshot = this.snapshot();
    this.#events?.emit('world-clock:changed', snapshot);
    return snapshot;
  }

  setTime(time) {
    if (this.#mode === 'live') {
      throw new Error('Switch to event or replay mode before setting a fixed time');
    }
    this.#fixedTimeMs = finiteTime(time);
    const snapshot = this.snapshot();
    this.#events?.emit('world-clock:changed', snapshot);
    return snapshot;
  }

  snapshot() {
    return Object.freeze({
      version: 1,
      mode: this.#mode,
      time: new Date(this.nowMs()).toISOString(),
    });
  }

  restore(snapshot) {
    if (!snapshot || snapshot.version !== 1) {
      throw new TypeError('Unsupported world clock snapshot');
    }
    return this.setMode(snapshot.mode, { time: snapshot.time });
  }
}
