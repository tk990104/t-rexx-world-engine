/** Unknown modules survive storage/export but cannot play without an adapter. */
export function normalizeSceneModules(raw = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid scene module context');
  const entries = Object.entries(raw);
  if (entries.length > 16) throw new Error('Too many scene modules');
  const result = {};
  for (const [id, value] of entries) {
    if (!/^[a-z][a-z0-9-]{0,63}$/.test(id) || ['constructor', 'prototype'].includes(id)) throw new Error('Invalid scene module ID');
    if (!value || typeof value !== 'object' || Array.isArray(value) || !Number.isInteger(value.version) || value.version < 1) throw new Error(`Invalid scene context for ${id}`);
    const json = JSON.stringify(value);
    if (json.length > 32768) throw new Error('Scene module context is too large');
    result[id] = JSON.parse(json);
  }
  return result;
}
