# AstroEye venue context

Click the selected purple venue marker to open its context card, or choose **Venue details** beneath the event chart. When the workspace is closed, **Selected event** provides a keyboard-accessible shortcut. Escape closes the context and returns focus to that shortcut. **Open event chart** restores the existing chart panel and focuses its heading without selecting the record again, recalculating the chart, resetting its preview offset, or moving the camera. Only **View venue** explicitly navigates.

The context distinguishes the original scheduled local/IANA/UTC event time from the chart's current calculated UTC instant and preview offset. It also displays venue coordinates and coordinate source, event-provider provenance, house method, saved versus unsaved selection status, and a selected-venue/body/aspect summary. This is a summary of the current selection, not a global data-layer inventory. Source metadata is not a claim of independent verification.

## Integration

- `workspaceController.selectionSnapshot()` returns an isolated copy of the last committed selection, including the displayed chart. It is updated before selection/time notifications and cleared on deletion. Context rendering reads this snapshot rather than doing calculations or storage queries.
- `venueContext.js` builds a plain-text model. `venueContextPanel.js` uses textContent for every event/provider value; no event strings are interpreted as HTML, URLs, or commands.
- The card is mounted through the existing PanelRegistry as `astroeye-venue-context`, declared in the AstroEye manifest. The workspace and context do not overlap as active module panels. Closing the workspace to show context also leaves event-sky mode through the existing cleanup path.
- `venueInteraction.js` registers the selected marker with the existing pick-ownership registry, so cooperating flight/other-layer handlers recognize it as someone else's target. It uses a single topmost scene pick; it does not drill through other markers or globe surfaces.
- The existing click-gesture classifier rejects camera drags. Picking is gated while Director runs or the workspace is busy. Disposal removes the handler, pick ownership and context subscriptions, and disowns a queued open.
- The context and selected-event shortcut are hidden during scene playback. No new timer, render loop, per-frame calculation, API request, record write, or automatic camera move is introduced.
- The marker label now explicitly identifies its time as **Event start**, avoiding confusion with the separate chart preview.

## Verification and scope

Focused tests cover DST-fold event versus chart time, manual/provider provenance, defensive snapshots, notification ordering, owned versus unrelated picks, drag rejection, playback gating and disposal. The manifest contract test now expects both supported panels.

`node scripts/qa-astroeye-venue.mjs` exercises a synthetic event in an isolated browser with system fallback fonts. It checks the real rendered marker click, plain-text handling of markup-like event names, desktop/mobile layout, Escape/Enter focus flow, camera preservation, exact chart-wheel/preview preservation, untouched records, and marker/shortcut removal after explicitly deleting only the synthetic event. No user browser data is read or changed.

This is the venue pick/context slice of M3. Multi-event layer management, annotations, broader source validation, and the remaining release gates are still separate work; this does not declare the entire MVP complete.

The milestone passed 116 platform tests and 51 pick/gesture/Director tests, a production build, the venue browser walkthrough, and the existing full tour browser regression. Browser checks used an isolated production preview with external fonts disabled. The tour rerun initially encountered a stopped temporary preview server; restarting that test server resolved the connection failure without an application change.
