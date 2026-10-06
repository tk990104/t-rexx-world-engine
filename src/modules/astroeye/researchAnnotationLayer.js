import * as Cesium from 'cesium';
import { validateResearchAnnotations, MAX_RESEARCH_ANNOTATIONS } from './researchAnnotations.js';
import { registerPickOwner, unregisterPickOwner } from '../../data/pickRegistry.js';

let sequence = 0;
export const researchNoteEntityId = (id) => `t-rexx-astroeye-note-${encodeURIComponent(id)}`;
// Nearby notes remain legible over buildings; distant notes respect depth occlusion.
export const NOTE_MARKER_DEPTH_OVERRIDE_METERS = 200000;

/** Session opt-in only. Not part of the shared annotation board or layer/URL catalog. */
export function createResearchAnnotationLayer({ viewer, loadAnnotations, eventBus, canDisplay = () => true, modeTarget = null }) {
  const owner = `astroeye-note-markers-${++sequence}`, owned = new Map(), listeners = new Set();
  let enabled = false, disposed = false, loading = false, generation = 0, error = '';
  const state = () => ({ enabled, loading, available: !disposed && canDisplay(), shown: owned.size, limit: MAX_RESEARCH_ANNOTATIONS, error });
  const notify = () => { for (const listener of listeners) listener(state()); };
  function clear() {
    for (const entity of owned.values()) if (viewer.entities.getById(entity.id) === entity) viewer.entities.remove(entity);
    owned.clear(); viewer.scene.requestRender();
  }
  function hide() { generation++; enabled = false; loading = false; error = ''; clear(); notify(); }
  function checkSafety() { if (!disposed && !canDisplay()) hide(); }
  registerPickOwner(owner, (id) => owned.has(id) && viewer.entities.getById(id) === owned.get(id));
  async function refresh() {
    if (disposed || !enabled) return;
    if (!canDisplay()) { hide(); return; }
    const version = ++generation;
    loading = true; error = ''; clear(); notify();
    try {
      const collection = validateResearchAnnotations(await loadAnnotations());
      if (disposed || version !== generation || !enabled) return;
      if (!canDisplay()) { hide(); return; }
      // Retain only the fields needed for markers. Private note text is never copied into an entity.
      const points = (collection?.annotations ?? []).map(({ id, chartTimeUtc, latitude, longitude }) => ({ id, chartTimeUtc, latitude, longitude }));
      points.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
      // Exact coordinate matches share one label; do not jitter saved locations
      // or approximate nearby locations into a new capture position.
      const locations = new Map();
      const locationKey = (point) => `${point.latitude},${point.longitude}`;
      for (const point of points) {
        const key = locationKey(point), group = locations.get(key);
        if (!group) locations.set(key, { leader: point.id, count: 1, first: point.chartTimeUtc, last: point.chartTimeUtc });
        else {
          group.count++;
          if (point.chartTimeUtc < group.first) group.first = point.chartTimeUtc;
          if (point.chartTimeUtc > group.last) group.last = point.chartTimeUtc;
        }
      }
      for (const point of points) {
        const group = locations.get(locationKey(point));
        const label = group.count === 1 ? `Event note · captured UTC\n${point.chartTimeUtc}`
          : `${group.count} event notes · captured UTC\n${group.first === group.last ? group.first : `First: ${group.first}\nLast: ${group.last}`}`;
        const id = researchNoteEntityId(point.id);
        const entity = viewer.entities.add({ id, name: 'Local event note',
          position: Cesium.Cartesian3.fromDegrees(point.longitude, point.latitude, 100),
          point: { color: Cesium.Color.fromCssColorString('#ffc66d'), pixelSize: 10,
            outlineColor: Cesium.Color.fromCssColorString('#33230c'), outlineWidth: 2,
            disableDepthTestDistance: NOTE_MARKER_DEPTH_OVERRIDE_METERS },
          label: { text: group.leader === point.id ? label : '', show: group.leader === point.id,
            font: '12px sans-serif', fillColor: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.fromCssColorString('#33230c'), outlineWidth: 3,
            // Event/venue labels sit above this same location; keep note times below.
            style: Cesium.LabelStyle.FILL_AND_OUTLINE, verticalOrigin: Cesium.VerticalOrigin.TOP,
            pixelOffset: new Cesium.Cartesian2(0, 12),
            distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 200000),
            disableDepthTestDistance: NOTE_MARKER_DEPTH_OVERRIDE_METERS },
        });
        owned.set(id, entity);
      }
    } catch {
      if (disposed || version !== generation || !enabled) return;
      clear(); error = 'Note markers could not be loaded or drawn. Records were not changed. Hide and show markers to retry.';
    }
    loading = false; viewer.scene.requestRender(); notify();
  }
  const unsubscribes = [eventBus.on('astroeye:records-imported', () => { void refresh(); }),
    eventBus.on('astroeye:event-selected', checkSafety)];
  const observer = modeTarget ? new modeTarget.ownerDocument.defaultView.MutationObserver(checkSafety) : null;
  observer?.observe(modeTarget, { attributes: true, attributeFilter: ['class'] });
  return Object.freeze({
    state, refresh,
    subscribe(listener) { listeners.add(listener); listener(state()); return () => listeners.delete(listener); },
    async setEnabled(value) {
      if (disposed) return;
      if (value !== true || !canDisplay()) { hide(); return; }
      enabled = true; await refresh();
    },
    destroy() {
      if (disposed) return;
      disposed = true; hide(); observer?.disconnect(); unsubscribes.forEach((off) => off());
      unregisterPickOwner(owner); listeners.clear();
    },
  });
}
