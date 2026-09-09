function requireText(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`Panel ${field} must be a non-empty string`);
  }
  return value.trim();
}

/** One mounting seam for module-owned panels inside the existing shell. */
export class PanelRegistry {
  #panels = new Map();
  #activePanelId = null;
  #cleanup = null;
  #events;

  constructor({ eventBus = null } = {}) {
    this.#events = eventBus;
  }

  register(definition) {
    if (!definition || typeof definition.mount !== 'function') {
      throw new TypeError('Panel definition must include mount(host, context)');
    }
    const panel = Object.freeze({
      ...definition,
      id: requireText(definition.id, 'id'),
      title: requireText(definition.title, 'title'),
      owner: requireText(definition.owner, 'owner'),
    });
    if (this.#panels.has(panel.id)) throw new Error(`Panel already registered: ${panel.id}`);
    this.#panels.set(panel.id, panel);
    return panel;
  }

  get activePanelId() {
    return this.#activePanelId;
  }

  get(id) {
    return this.#panels.get(id) ?? null;
  }

  list({ owner } = {}) {
    const panels = [...this.#panels.values()];
    return owner ? panels.filter((panel) => panel.owner === owner) : panels;
  }

  async show(id, host, context = {}) {
    const panel = this.get(id);
    if (!panel) throw new Error(`Unknown panel: ${id}`);
    if (id === this.#activePanelId) return panel;

    await this.hide();
    const cleanup = await panel.mount(host, context);
    if (cleanup != null && typeof cleanup !== 'function') {
      throw new TypeError(`Panel ${id} mount must return a cleanup function or nothing`);
    }
    this.#cleanup = cleanup ?? null;
    this.#activePanelId = id;
    this.#events?.emit('panel:shown', { panelId: id, moduleId: panel.owner });
    return panel;
  }

  async hide() {
    if (!this.#activePanelId) return null;
    const panel = this.get(this.#activePanelId);
    const cleanup = this.#cleanup;
    const panelId = this.#activePanelId;
    this.#cleanup = null;
    this.#activePanelId = null;
    await cleanup?.();
    await panel?.unmount?.();
    this.#events?.emit('panel:hidden', { panelId, moduleId: panel?.owner ?? null });
    return panel;
  }
}
