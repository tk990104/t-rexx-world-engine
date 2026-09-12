export const MAX_IMPORT_FILE_BYTES = 10 * 1024 * 1024;

/** Keep validated import contents private until an explicit, single-use confirmation. */
export function createRecordImportReview({ recordStore, onImported = () => {} }) {
  let generation = 0;
  let pending = null;
  return Object.freeze({
    cancelImportReview() {
      generation++;
      pending = null;
    },
    async prepareImportRecords(input) {
      const current = ++generation;
      pending = null;
      const prepared = await recordStore.previewImportRecords(input);
      if (current !== generation) return null;
      pending = prepared;
      return structuredClone(prepared.summary);
    },
    async confirmImportRecords({ allowOverwrite = false } = {}) {
      if (!pending) throw new Error('Choose a file and review it before confirming an import.');
      const counts = Object.values(pending.summary);
      if (!counts.some((entry) => entry.added || entry.overwrite)) {
        throw new Error('All records already match. Nothing needs to be imported.');
      }
      if (counts.some((entry) => entry.overwrite) && allowOverwrite !== true) {
        throw new Error('Acknowledge overwriting changed records before confirming this import.');
      }
      const prepared = pending;
      pending = null;
      generation++;
      const result = await recordStore.importRecords(prepared.records, {
        mode: 'merge', expectedSnapshot: prepared.expectedSnapshot,
      });
      onImported(result);
      return result;
    },
  });
}
