export const ASTROEYE_CALLOUT_OWNER = 'astroeye';
export const ASTROEYE_CALLOUT_LIMIT = 5;

export function eventCalloutSpec(selection, note = '') {
  if (!selection?.event || !selection?.chart) throw new Error('Choose an event before adding a callout.');
  if (typeof note !== 'string' || note.length > 40) throw new Error('Use a note of 40 characters or fewer.');
  const { latitude, longitude } = selection.event.venue;
  if (!Number.isFinite(latitude) || Math.abs(latitude) > 90 || !Number.isFinite(longitude) || Math.abs(longitude) > 180) throw new Error('Valid venue coordinates are required.');
  const time = new Date(selection.chart.calculatedFor);
  if (!Number.isFinite(time.getTime())) throw new Error('A valid chart time is required.');
  const caption = (note.trim() || selection.event.title).replace(/\s+/g, ' ').slice(0, 40).replace(/[\uD800-\uDBFF]$/u, '');
  const instant = time.toISOString().slice(0, 19).replace('T', ' ');
  return Object.freeze({ type: 'label', latitude, longitude, footprint: false,
    color: 'cyan', label: `AstroEye ${instant} UTC · ${caption}` });
}

/** Session-only snapshots on the shared board, with scoped cleanup and no navigation. */
export function createEventCallouts({ annotations, getSelection, canInteract = () => true }) {
  let generation = 0;
  let pending = false;
  const owned = () => annotations.list().filter((mark) => mark.owner === ASTROEYE_CALLOUT_OWNER);
  return Object.freeze({
    count: () => owned().length,
    async add(note) {
      if (!canInteract()) throw new Error('Stop the current preview before adding a callout.');
      if (pending) throw new Error('A callout is already being added.');
      if (owned().length >= ASTROEYE_CALLOUT_LIMIT) throw new Error('Five AstroEye callouts are already on the map. Clear them before adding more.');
      const spec = eventCalloutSpec(getSelection(), note);
      const started = generation;
      const previousIds = new Set(owned().map((mark) => mark.id));
      pending = true;
      try {
        const result = await annotations.annotate([spec], {
          owner: ASTROEYE_CALLOUT_OWNER, persist: true, clearPrevious: false, flyTo: false, ensureVisible: false,
        });
        if (started !== generation || !canInteract()) {
          for (const id of result.ids || []) if (!previousIds.has(id)) annotations.remove(id, { owner: ASTROEYE_CALLOUT_OWNER });
          return { cancelled: true };
        }
        if (!result.ok) throw new Error(result.capped ? 'The map annotation limit was reached.' : 'The callout could not be drawn. Try again.');
        return { label: spec.label, count: owned().length };
      } finally { pending = false; }
    },
    clear() {
      generation++;
      let removed = 0;
      for (const mark of owned()) if (annotations.remove(mark.id, { owner: ASTROEYE_CALLOUT_OWNER })) removed++;
      return removed;
    },
  });
}
