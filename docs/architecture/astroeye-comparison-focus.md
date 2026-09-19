# Chart comparison keyboard focus

September 19, 2026, checkpoint 110, from `8440b39`.

The isolated browser regression reproduced loss of focus to the document when a
current chart disappeared while the aspect-type filter was focused. A refresh
could hide the aspect section or disable the focused comparison action. Clearing
the pinned chart without a current chart also tried to focus a disabled Pin button.

Comparison rendering now uses the existing guarded panel-focus helper. It retains
a usable origin, then falls back to enabled Pin, enabled Clear, or the comparison
heading. Clear prefers Pin and Reset filters prefers the aspect-type select, but
only when the panel owned focus before rendering. Hidden/unfocused documents and
external focus do not acquire a new focus destination. The heading has a negative
tab index (not an extra tab stop), and comparison descendants get a visible cyan
keyboard-focus outline. No calculation, pin lifetime, filter, report or storage
semantics change.

## Verification

- All 51 focused tests pass (1.212 seconds): comparison snapshots, reports,
  cross-chart aspects and filters, the shared focus helper and browser cleanup.
- The expanded `scripts/qa-astroeye-comparison.mjs` passes in a disposable browser,
  using the real comparison panel/CSS and synthetic in-memory chart snapshots.
  Seven origins are checked against both missing and incompatible current charts,
  including the focusable results region. Compatible updates retain focus; outside
  and hidden-panel updates do not steal it. Clear without a current chart lands on
  the heading; its outline and Shift+Tab exit are verified. Existing filter/report
  parity, immutable snapshots, narrow/wide layout, reset/clear, compatibility and
  teardown checks also pass. No page errors or external/API requests.
- Final browser exit is 0, with graceful cleanup in 1.824 seconds and no forced
  termination. The harness now uses the shared bounded owned-browser cleanup
  helper under its existing 60-second overall cap. Before the final pass, the new
  test reproduced the runtime bug, then two harness-only errors were corrected:
  unsupported combined-key syntax and a shadowed result variable. Those runs
  exited 1 and closed their browsers gracefully; they are not passing evidence.
- Production build passes: 261 modules, 17.31 seconds, with the existing node:fs
  externalization and large-chunk warnings. Diff-whitespace check passes.

Run the dedicated local server and set `QA_BASE_URL` to its loopback origin before
running `node scripts/qa-astroeye-comparison.mjs`. The separate port-5175 server
used here was stopped. The user preview and saved research were untouched;
nothing was published. No main app, real globe, screen-reader speech or full
workspace/Director acceptance is claimed. Platform/full/allocation suites were
not rerun for this bounded fix. Five gates remain accepted, ten open; U2 remains
open. Next is broader workspace keyboard/accessibility review, not release signoff.
