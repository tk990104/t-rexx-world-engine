import * as Cesium from 'cesium';
import { ASTROEYE_EVENT_ENTITY_ID } from './worldPresenter.js';
import { registerPickOwner, unregisterPickOwner, resolvePickId } from '../../data/pickRegistry.js';
import { bindTrackingClickGesture, isTrackingSelectionGesture } from '../../data/trackingClickGesture.js';

const OWNER = 'astroeye-event-marker';

/** One click handler, no hover picker, timer, camera move or render loop. */
export function installAstroEyeVenueInteraction({
  viewer, onOpen, hasSelection, canInteract = () => true,
  savedEventIdForEntity = () => null, onSavedEvent = () => {},
  createHandler = (canvas) => new Cesium.ScreenSpaceEventHandler(canvas),
}) {
  const handler = createHandler(viewer.scene.canvas);
  let destroyed = false;
  const ownsSelected = (id) => hasSelection() && id === ASTROEYE_EVENT_ENTITY_ID;
  registerPickOwner(OWNER, (id) => !destroyed && (ownsSelected(id) || savedEventIdForEntity(id) !== null));
  bindTrackingClickGesture(handler, (click, gesture) => {
    if (destroyed || !canInteract() || !isTrackingSelectionGesture(gesture)) return;
    // Only the topmost pick is actionable: never open a venue through another layer.
    let picked;
    try { picked = viewer.scene.pick(click.position); } catch { return; }
    const id = resolvePickId(picked);
    if (!ownsSelected(id) && savedEventIdForEntity(id) === null) return;
    void Promise.resolve().then(() => {
      if (destroyed || !canInteract()) return;
      if (ownsSelected(id)) return onOpen();
      const eventId = savedEventIdForEntity(id);
      if (eventId !== null) return onSavedEvent(eventId);
    }).catch(() => { /* A rejected UI callback must not become an unhandled scene event. */ });
  });
  return () => {
    if (destroyed) return;
    destroyed = true;
    unregisterPickOwner(OWNER);
    handler.destroy();
  };
}
