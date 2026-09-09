function requireModuleId(moduleId) {
  if (typeof moduleId !== 'string' || !moduleId.trim()) {
    throw new TypeError('Module id must be a non-empty string');
  }
  return moduleId.trim();
}

function cloneJson(value) {
  if (value == null) return value;
  const json = JSON.stringify(value);
  if (json == null) throw new TypeError('Module state must be JSON-serializable');
  return JSON.parse(json);
}

/** Versioned state boundary between product modules and share/project codecs. */
export class ModuleStateCoordinator {
  #activeModuleId = null;
  #states = new Map();
  #events;

  constructor({ eventBus = null } = {}) {
    this.#events = eventBus;
  }

  get activeModuleId() {
    return this.#activeModuleId;
  }

  setActiveModule(moduleId) {
    const next = moduleId == null ? null : requireModuleId(moduleId);
    if (next === this.#activeModuleId) return false;
    this.#activeModuleId = next;
    this.#events?.emit('module-state:active-changed', { moduleId: next });
    return true;
  }

  set(moduleId, state) {
    const id = requireModuleId(moduleId);
    const stored = cloneJson(state);
    this.#states.set(id, stored);
    this.#events?.emit('module-state:changed', { moduleId: id, state: cloneJson(stored) });
    return cloneJson(stored);
  }

  get(moduleId) {
    const state = this.#states.get(moduleId);
    return state == null ? null : cloneJson(state);
  }

  clear(moduleId) {
    const id = requireModuleId(moduleId);
    const removed = this.#states.delete(id);
    if (removed) this.#events?.emit('module-state:changed', { moduleId: id, state: null });
    return removed;
  }

  snapshot() {
    const modules = Object.fromEntries(
      [...this.#states.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([id, state]) => [id, cloneJson(state)]),
    );
    return {
      version: 1,
      activeModuleId: this.#activeModuleId,
      modules,
    };
  }

  restore(snapshot) {
    if (!snapshot || snapshot.version !== 1 || typeof snapshot.modules !== 'object') {
      throw new TypeError('Unsupported module-state snapshot');
    }
    const restored = new Map();
    for (const [id, state] of Object.entries(snapshot.modules)) {
      restored.set(requireModuleId(id), cloneJson(state));
    }
    this.#states = restored;
    this.#activeModuleId = snapshot.activeModuleId == null
      ? null
      : requireModuleId(snapshot.activeModuleId);
    this.#events?.emit('module-state:restored', this.snapshot());
    return this.snapshot();
  }
}
