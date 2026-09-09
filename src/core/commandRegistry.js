function requireText(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`Command ${field} must be a non-empty string`);
  }
  return value.trim();
}

function normalizeParameters(parameters) {
  if (parameters == null) return Object.freeze({ type: 'object', properties: {} });
  if (parameters.type !== 'object') throw new TypeError('Command parameters must be a JSON object schema');
  return Object.freeze({ ...parameters });
}

/** Canonical command source for UI, local voice, and Realtime tool schemas. */
export class CommandRegistry {
  #commands = new Map();

  register(definition) {
    if (!definition || typeof definition.execute !== 'function') {
      throw new TypeError('Command definition must include execute(args, context)');
    }
    const command = Object.freeze({
      ...definition,
      name: requireText(definition.name, 'name'),
      description: requireText(definition.description, 'description'),
      owner: requireText(definition.owner, 'owner'),
      parameters: normalizeParameters(definition.parameters),
      safeForLocalVoice: definition.safeForLocalVoice === true,
      mutatesWorldState: definition.mutatesWorldState !== false,
    });
    if (this.#commands.has(command.name)) {
      throw new Error(`Command already registered: ${command.name}`);
    }
    this.#commands.set(command.name, command);
    return command;
  }

  get(name) {
    return this.#commands.get(name) ?? null;
  }

  list({ owner } = {}) {
    const commands = [...this.#commands.values()];
    return owner ? commands.filter((command) => command.owner === owner) : commands;
  }

  async execute(name, args = {}, context = {}) {
    const command = this.get(name);
    if (!command) throw new Error(`Unknown command: ${name}`);
    return command.execute(args, context);
  }

  toRealtimeTools() {
    return this.list().map(({ name, description, parameters }) => ({
      type: 'function',
      name,
      description,
      parameters,
    }));
  }

  toLocalVoiceCatalog() {
    return this.list()
      .filter(({ safeForLocalVoice }) => safeForLocalVoice)
      .map(({ name, description, owner, mutatesWorldState }) => ({
        name,
        description,
        owner,
        mutatesWorldState,
      }));
  }
}
