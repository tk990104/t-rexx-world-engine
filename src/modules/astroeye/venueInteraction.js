import * as Cesium from 'cesium';
import { ASTROEYE_EVENT_ENTITY_ID } from './worldPresenter.js';
import { registerPickOwner, unregisterPickOwner, resolvePickId } from '../../data/pickRegistry.js';
import { bindTrackingClickGesture, isTrackingSelectionGesture } from '../../data/trackingClickGesture.js';

const OWNER = 'astroeye-event-marker';

/** One click handler, no hover picker, timer, camera move or render loop. */
export function installAstroEyeVenueInteraction({
  viewer, onOpen, hasSelection, canInteract = () => true,
  createHandler = (canvas) => new Cesium.ScreenSpaceEventHandler(canvas),
}) {
  const handler = createHandler(viewer.scene.canvas);
  let destroyed = false;
  registerPickOwner(OWNER, (id) => !destroyed && hasSelection() && id === ASTROEYE_EVENT_ENTITY_ID);
  bindTrackingClickGesture(handler, (click, gesture) => {
    if (destroyed || !hasSelection() || !canInteract() || !isTrackingSelectionGesture(gesture)) return;
    // Only the topmost pick is actionable: never open a venue through another layer.
    let picked;
    try { picked = viewer.scene.pick(click.position); } catch { return; }
    if (resolvePickId(picked) !== ASTROEYE_EVENT_ENTITY_ID) return;
    void Promise.resolve().then(() => {
      if (!destroyed && hasSelection() && canInteract()) return onOpen();
    }).catch(() => { /* A rejected UI callback must not become an unhandled scene event. */ });
  });
  return () => {
    if (destroyed) return;
    destroyed = true;
    unregisterPickOwner(OWNER);
    handler.destroy();
  };
}
