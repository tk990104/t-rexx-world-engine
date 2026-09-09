/** Small synchronous event bus shared by world modules. */
export class EventBus {
  #listeners = new Map();

  on(type, listener) {
    if (typeof type !== 'string' || !type.trim()) {
      throw new TypeError('Event type must be a non-empty string');
    }
    if (typeof listener !== 'function') {
      throw new TypeError('Event listener must be a function');
    }

    const listeners = this.#listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.#listeners.set(type, listeners);
    return () => this.off(type, listener);
  }

  once(type, listener) {
    const unsubscribe = this.on(type, (payload) => {
      unsubscribe();
      listener(payload);
    });
    return unsubscribe;
  }

  off(type, listener) {
    const listeners = this.#listeners.get(type);
    if (!listeners) return false;
    const removed = listeners.delete(listener);
    if (listeners.size === 0) this.#listeners.delete(type);
    return removed;
  }

  emit(type, payload) {
    const listeners = [...(this.#listeners.get(type) ?? [])];
    for (const listener of listeners) listener(payload);
    return listeners.length;
  }

  clear(type) {
    if (type == null) {
      this.#listeners.clear();
      return;
    }
    this.#listeners.delete(type);
  }
}
