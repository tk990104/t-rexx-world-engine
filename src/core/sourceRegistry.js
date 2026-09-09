function requireText(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`Source ${field} must be a non-empty string`);
  }
  return value.trim();
}

/** Makes provider identity, terms, attribution, and cache rules inspectable. */
export class SourceRegistry {
  #sources = new Map();

  register(source) {
    if (!source || typeof source !== 'object') throw new TypeError('Source definition is required');
    const normalized = Object.freeze({
      ...source,
      id: requireText(source.id, 'id'),
      title: requireText(source.title, 'title'),
      license: requireText(source.license, 'license'),
      attribution: requireText(source.attribution, 'attribution'),
      cachePolicy: requireText(source.cachePolicy, 'cachePolicy'),
    });
    if (this.#sources.has(normalized.id)) {
      throw new Error(`Source already registered: ${normalized.id}`);
    }
    this.#sources.set(normalized.id, normalized);
    return normalized;
  }

  get(id) {
    return this.#sources.get(id) ?? null;
  }

  list() {
    return [...this.#sources.values()];
  }
}
