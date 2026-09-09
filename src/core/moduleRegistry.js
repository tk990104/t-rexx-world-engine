const MODULE_LIST_FIELDS = ['layers', 'panels', 'commands', 'sceneRecipes', 'credits'];

function requireText(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`Module ${field} must be a non-empty string`);
  }
  return value.trim();
}

function normalizeModule(definition) {
  if (!definition || typeof definition !== 'object') throw new TypeError('Module definition is required');
  const normalized = {
    ...definition,
    id: requireText(definition.id, 'id'),
    title: requireText(definition.title, 'title'),
    version: requireText(definition.version, 'version'),
    capabilitiesRequired: Object.freeze([...(definition.capabilitiesRequired ?? [])]),
  };
  for (const field of MODULE_LIST_FIELDS) normalized[field] = Object.freeze([...(definition[field] ?? [])]);
  if (definition.start != null && typeof definition.start !== 'function') throw new TypeError('Module start must be a function');
  if (definition.stop != null && typeof definition.stop !== 'function') throw new TypeError('Module stop must be a function');
  return Object.freeze(normalized);
}

/** Owns module registration and ensures exactly one product module is active. */
export class ModuleRegistry {
  #modules = new Map();
  #activeId = null;
  #context;
  #events;

  constructor({ context = {}, eventBus = null } = {}) {
    this.#context = context;
    this.#events = eventBus;
  }

  register(definition) {
    const module = normalizeModule(definition);
    if (this.#modules.has(module.id)) throw new Error(`Module already registered: ${module.id}`);
    this.#modules.set(module.id, module);
    this.#events?.emit('module:registered', { moduleId: module.id });
    return module;
  }

  get activeId() {
    return this.#activeId;
  }

  get(id) {
    return this.#modules.get(id) ?? null;
  }

  list() {
    return [...this.#modules.values()];
  }

  setContext(context) {
    if (!context || typeof context !== 'object') throw new TypeError('World context must be an object');
    if (this.#activeId) throw new Error('Cannot replace world context while a module is active');
    this.#context = context;
  }

  async activate(id) {
    const next = this.get(id);
    if (!next) throw new Error(`Unknown module: ${id}`);
    if (id === this.#activeId) return next;

    const missing = next.capabilitiesRequired.filter((capability) => this.#context[capability] == null);
    if (missing.length) throw new Error(`Module ${id} is missing capabilities: ${missing.join(', ')}`);

    await this.deactivate();
    await next.start?.({ ...this.#context, moduleRegistry: this });
    this.#activeId = id;
    this.#events?.emit('module:activated', { moduleId: id });
    return next;
  }

  async deactivate() {
    if (!this.#activeId) return null;
    const current = this.get(this.#activeId);
    await current?.stop?.({ ...this.#context, moduleRegistry: this });
    const moduleId = this.#activeId;
    this.#activeId = null;
    this.#events?.emit('module:deactivated', { moduleId });
    return current;
  }

  snapshot() {
    const active = this.#activeId ? this.get(this.#activeId) : null;
    return Object.freeze({
      version: 1,
      activeModuleId: this.#activeId,
      moduleState: active?.serializeState?.() ?? null,
    });
  }
}
