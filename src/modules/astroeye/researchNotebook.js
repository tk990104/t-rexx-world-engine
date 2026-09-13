export const RESEARCH_NOTEBOOK_ID = 'astroeye-research-notebook-v1';
export const MAX_RESEARCH_NOTE_LENGTH = 10000;

function validate(record) {
  if (record === null) return null;
  if (record.id !== RESEARCH_NOTEBOOK_ID || record.kind !== 'astroeye-research-notebook' || record.schemaVersion !== 1
    || typeof record.text !== 'string' || record.text.length > MAX_RESEARCH_NOTE_LENGTH) {
    throw new Error('Saved notebook has an unsupported format. It was not changed. Keep a full backup before inspecting it.');
  }
  return record;
}

/** Only the global local notebook, never chart/event selection or camera state. */
export function createResearchNotebook(recordStore) {
  return Object.freeze({
    async load() { return validate(await recordStore.getWorkspace(RESEARCH_NOTEBOOK_ID)); },
    async save(text, expected) {
      if (typeof text !== 'string' || text.length > MAX_RESEARCH_NOTE_LENGTH) throw new RangeError('Research notes must be text of at most 10,000 characters.');
      validate(expected);
      const record = { ...(expected ?? {}), id: RESEARCH_NOTEBOOK_ID, kind: 'astroeye-research-notebook', schemaVersion: 1, text };
      return recordStore.saveWorkspaceIfUnchanged(record, expected);
    },
  });
}
