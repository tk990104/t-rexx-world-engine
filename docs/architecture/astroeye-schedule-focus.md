# Schedule keyboard focus and disposal

September 19, 2026, checkpoint 111, from `aea90b7`.

The schedule panel disabled its active buttons during lookup without restoring
focus afterward. Its workspace selection callback unconditionally focused the
time-zone field, even if the user had moved elsewhere during venue lookup. Its
destroy method aborted the current request but left the click listener installed.

The panel now captures focus ownership before disabling controls and restores the
enabled origin after successful, empty or failed schedule requests. The workspace
callback returns the review field instead of focusing it directly; the existing
shared helper permits that handoff only while focus ownership remains valid. The
wider workspace is the allowed destination scope, not permission to capture an
action started with focus outside the schedule panel. Later input, outside focus,
hidden/unfocused documents and cancellation suppress restoration. A cyan outline
makes schedule keyboard focus visible.

Cancellation clears pending focus responsibility and aborts the request. Destroy
also removes the listener and permanently prevents further interaction. Generation
checks keep stale completions from selecting a game or enabling newer requests.
The existing provider/form population and explicit review rules are unchanged;
this is focus protection, not a new pending-form-edit conflict policy.

## Verification

- All 38 focused tests pass (0.844 seconds): sports normalization/proxy/review,
  shared focus behavior and owned-browser cleanup.
- New `scripts/qa-astroeye-schedule-focus.mjs` passes using the real panel/CSS,
  held in-memory callbacks and no app storage or provider requests. Covers both
  Upcoming and Find games with successful/empty/failed results, visible focus,
  outside/hidden focus, normal and missing-venue review handoff, no focus stealing
  after moving away or programmatic activation, cancel/replacement stale results,
  repeated destroy, late completion and inert disposed interaction. Browser exit
  0 with graceful cleanup in 2.226 seconds; no force or page errors.
- The initial isolated run passed its interaction assertions but exited 1 because
  the request guard counted Chromium's inline calendar SVG as external traffic.
  The guard now allows that inline image form only; external/API requests remain
  blocked. The failed run also closed gracefully. It is not passing evidence.
- Expanded `scripts/qa-astroeye-provider-workspace.mjs --node-assets` passes with
  real workspace/controller and disposable IndexedDB, synthetic provider responses
  and the existing diagnostic localhost asset relay. Keyboard Upcoming returns
  focus to Upcoming; keyboard selection moves to the time-zone field. Existing
  explicit review, second repeated-hour instant, provenance, missing-coordinate
  refusal, manual fallback and private synthetic research checks also pass.
  Browser exit 0 with graceful cleanup in 2.238 seconds, no force or page errors.
  This is not a live-provider or embedded-host loading certification.
- Production build passes: 261 modules, 13.11 seconds, with the existing node:fs
  externalization and large-chunk warnings. Diff-whitespace check passes.

Both browser scripts have a 60-second overall watchdog and target disposable
profiles only. The separate port-5175 server was stopped; the user's preview and
saved research were untouched. Nothing published. No platform/full/allocation
suite rerun, native screen-reader speech, full map/Director or release acceptance
claim. Five gates remain accepted and ten open; U2 remains open. Follow-up review
should cover pending provider handoffs versus new manual form edits and the
remaining workspace keyboard/status flows.
