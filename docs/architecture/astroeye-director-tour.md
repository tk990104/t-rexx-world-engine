# AstroEye event tour

Choose an event and chart time, then use **Add event tour** beneath the chart. This appends three editable Director shots: World, Region, and Venue. **Preview saved tour** plays only that scene for approximately 18 seconds. A visible **Stop preview** button and Escape interrupt playback. The chart panel is temporarily hidden and returns after completion or cancellation. The camera remains where playback ended.

The tour uses the current house system and time-explorer offset, including the original explicit UTC occurrence during a daylight-saving fold. Each shot includes the selected preview's UTC label. Changing the current chart later does not rewrite an existing tour; add another tour to capture the new inputs. Director's existing load, capture, update, and preset import/export controls retain module context. A missing/deleted tour is refused rather than playing another scene.

## Boundaries

- This is a preview, not a video recorder, downloadable movie, historical map, or live-feed replay. Existing map sources and attribution remain in use. Video/export policy enforcement remains a separate release requirement.
- Only the normal visual preset and camera pose are authored. Live layers are not toggled by the recipe, and Cesium's live-feed clock is not set to the event time.
- Event sky is cleared while approaching the venue. The saved tour does not opt into celestial-ring overrides.
- Scene context contains validated event/calculation inputs, not trusted precomputed chart output. Playback recalculates and restores an unsaved selection without inserting, replacing, or deleting IndexedDB records. **Save a copy** remains explicit.
- Scene storage and exported presets contain event details, participants, venue coordinates, source provenance, house method and preview offset. They are unencrypted; review before sharing. No credentials, hidden notes, arbitrary extra fields or API keys are captured by AstroEye's allowlist.
- Adding a tour never replaces existing scenes. Browser storage failure reports session-only availability. The original event record and its original-time chart remain unchanged.

## Module-aware Director seam

Scene project version **4** adds optional `shot.modules`, a map of module IDs to versioned, bounded JSON payloads. The existing storage key remains unchanged. Version 1–3 projects still load; bloom scale migration remains pinned to version 3 rather than following the new project version.

`SceneDirector.registerModuleAdapter(id, { normalize, apply, capture? })` is the shell integration seam. AstroEye registers its own strict shared-view validator and workspace restorer. Future modules can register independent adapters without adding product calculations to Director. Unknown module payloads survive storage/export but refuse playback until their adapter is available. The whole queue is validated before playback changes camera, visuals or layers.

`apply` receives `isCurrent` and an AbortSignal. Adapters must check liveness around their awaits, must not independently fly the camera, and must not persist records during restoration. Director rechecks cancellation before each subsequent step. A later load disowns earlier restoration; Stop aborts the run. Legacy shots with no module state leave the current module state unchanged.

`createAstroEyeTour(view, { id })` is a deterministic recipe for identical canonical inputs and ID. Each UI addition allocates a fresh ID; per-shot payloads are independent clones. `addScene` normalizes and appends, then reports whether persistence succeeded.

## Verification

Focused tests cover deterministic shot generation, fold/preview preservation, payload filtering, schema migration, legacy bloom values, append/reload, missing modules, missing scenes, camera ownership, Stop during suspended restoration, and newer-load cancellation. The source-based Director regression check normalizes Windows line endings before matching its existing cancellation assertions.

`node scripts/qa-astroeye-tour.mjs` uses a fresh browser profile and a synthetic event to check desktop/mobile layout, append, complete playback, Stop/Escape, exact preview restoration, untouched records, reload, shot loading, and preset import. Screenshots are local ignored QA artifacts, not shipped assets.

The implementation check passed 111 platform tests and 38 Director/policy tests, plus a production build. The complete browser flow passed against the local production preview with `--offline-fonts` (system fallback fonts; no external Google font requests). Development-page startup had intermittent navigation timeouts; an initial QA loading-screen predicate was also corrected. These are not claims of full-provider or whole-repository release certification.
