# View matching markers

Enable the saved-event map, optionally apply search/date filters, then choose **View matching markers**. The action closes the workspace and starts a short, top-down camera flight. Applying filters, refreshing records, or showing the layer still does not navigate automatically.

The destination uses only the currently displayed cyan markers (maximum 100), plus the selected **saved** event when it matches the applied filters. A selected-only match can be framed; an out-of-filter or unsaved shared selection does not expand the destination. Matching records beyond the display cap are not included. The button is unavailable while the map is off, loading, suspended, failed, or has no frameable matches.

`savedEventFrame.js` validates and computes the destination before requesting camera authority. It finds the shortest circular longitude interval so date-line neighbors stay together, pads tight/overlapping venues, and clamps latitude bounds at the poles. Regional views use Cesium's rectangle framing. Spreads of at least 120 degrees longitude or 100 degrees latitude use an 18,000 km globe overview; this cannot show the far side simultaneously, and the UI explicitly tells users to rotate the globe.

The composition root routes the explicit action through `styleManager.runImmediateNavigation`, retaining the existing camera release/supersession and Cockpit refusal rules. Director/workspace gates are checked before navigation. No new animation loop or completion-polling task is introduced. Existing events, charts, filters and annotations are not edited.

## Bounded verification

39 targeted frame, saved-layer, filter and navigation-policy tests passed. They cover the date line, co-located venues, poles, global spread, invalid/empty inputs, selected-only versus excluded selection, and camera ownership order/refusal. The production build passed with the existing bundle-size and browser-externalization warnings.

The 60-second-limited `scripts/qa-astroeye-filters.mjs` now checks the real framing control with a camera spy: no flight while filtering, disabled empty state, refusal while blocked, exactly one permitted camera request and panel dismissal. Its mobile screenshot was inspected. This is a lightweight DOM/integration check, not a full rendered-globe flight or tour regression run.
