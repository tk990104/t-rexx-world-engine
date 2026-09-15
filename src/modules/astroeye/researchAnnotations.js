export const RESEARCH_ANNOTATIONS_ID = 'astroeye-event-annotations-v1';
export const MAX_RESEARCH_ANNOTATIONS = 100;
export const MAX_ANNOTATION_NOTE_LENGTH = 2000;
const KIND = 'astroeye-event-annotations';
const FIELDS = ['id', 'schemaVersion', 'eventId', 'chartTimeUtc', 'latitude', 'longitude', 'note'];
const copy = (value) => structuredClone(value);

function exact(value, fields) {
  return value && [Object.prototype, null].includes(Object.getPrototypeOf(value))
    && Reflect.ownKeys(value).length === fields.length
    && fields.every((key) => Object.hasOwn(Object.getOwnPropertyDescriptor(value, key) ?? {}, 'value'));
}
function text(value, limit) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= limit;
}
function noteText(note) {
  if (!text(note, MAX_ANNOTATION_NOTE_LENGTH) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(note)) {
    throw new TypeError('Annotation notes require 1–2,000 plain-text characters.');
  }
  return note;
}
function utc(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
    || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) {
    throw new TypeError('Annotation chart time must be a canonical UTC timestamp.');
  }
  return value;
}
export function validateResearchAnnotation(record) {
  if (!exact(record, FIELDS) || record.schemaVersion !== 1
    || typeof record.id !== 'string' || !/^astroeye-note:[A-Za-z0-9_-]{1,100}$/.test(record.id)
    || !text(record.eventId, 200) || record.eventId.trim() !== record.eventId || /[\u0000-\u001f\u007f]/u.test(record.eventId)
    || !Number.isFinite(record.latitude) || Math.abs(record.latitude) > 90
    || !Number.isFinite(record.longitude) || Math.abs(record.longitude) > 180) {
    throw new TypeError('Unsupported annotation record. Existing records were not changed.');
  }
  utc(record.chartTimeUtc); noteText(record.note);
  return record;
}
export function validateResearchAnnotations(collection) {
  if (collection === null) return null;
  if (!exact(collection, ['id', 'kind', 'schemaVersion', 'annotations'])
    || collection.id !== RESEARCH_ANNOTATIONS_ID || collection.kind !== KIND
    || collection.schemaVersion !== 1 || !Array.isArray(collection.annotations)
    || collection.annotations.length > MAX_RESEARCH_ANNOTATIONS) {
    throw new TypeError('Unsupported annotation collection. Keep a full backup; records were not changed.');
  }
  for (const entry of collection.annotations) validateResearchAnnotation(entry);
  if (new Set(collection.annotations.map((entry) => entry.id)).size !== collection.annotations.length) {
    throw new TypeError('Duplicate annotation IDs are not supported.');
  }
  return collection;
}

/** Unmounted R1 storage contract. No renderer, clock, voice, notebook or selection
 * mutation. Each edit/delete compares the entire last-loaded collection atomically.
 * Source deletion leaves notes orphaned, not deleted; an existing same-ID source
 * resolves the reference again, without recapturing its time or coordinates. */
export function createResearchAnnotations(recordStore, { createId = () => `astroeye-note:${globalThis.crypto.randomUUID()}` } = {}) {
  const baseline = (expected) => copy(validateResearchAnnotations(expected));
  const save = (annotations, expected) => {
    const next = { id: RESEARCH_ANNOTATIONS_ID, kind: KIND, schemaVersion: 1, annotations };
    validateResearchAnnotations(next);
    return recordStore.saveWorkspaceIfUnchanged(next, expected);
  };
  return Object.freeze({
    async load() { return copy(validateResearchAnnotations(await recordStore.getWorkspace(RESEARCH_ANNOTATIONS_ID))); },
    async add(selection, note, expected) {
      const before = baseline(expected), annotations = before?.annotations ?? [];
      if (annotations.length >= MAX_RESEARCH_ANNOTATIONS) throw new RangeError('The 100 research annotation limit was reached.');
      if (!selection?.event || selection.chart?.eventId !== selection.event.id) throw new TypeError('Choose a chart belonging to the source event.');
      const entry = validateResearchAnnotation({ id: createId(), schemaVersion: 1, eventId: selection.event.id,
        chartTimeUtc: selection.chart.calculatedFor, latitude: selection.event.venue?.latitude,
        longitude: selection.event.venue?.longitude, note: noteText(note) });
      return save([...annotations, copy(entry)], before);
    },
    async edit(id, note, expected) {
      const before = baseline(expected);
      if (!before?.annotations.some((entry) => entry.id === id)) throw new Error('Annotation not found in the loaded collection.');
      noteText(note);
      return save(before.annotations.map((entry) => entry.id === id ? { ...entry, note } : entry), before);
    },
    async remove(id, expected) {
      const before = baseline(expected);
      if (!before?.annotations.some((entry) => entry.id === id)) throw new Error('Annotation not found in the loaded collection.');
      return save(before.annotations.filter((entry) => entry.id !== id), before);
    },
    async sourceState(entry) {
      const eventId = validateResearchAnnotation(entry).eventId;
      return await recordStore.getEvent(eventId) ? 'source-present' : 'source-missing';
    },
  });
}
