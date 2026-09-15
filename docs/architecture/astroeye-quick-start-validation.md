# AstroEye Quick start and combined workspace validation

September 15, 2026 — checkpoint 79, based on `efb47c0`.

## User-facing change

**AstroEye → Quick start** opens an in-workspace guide covering:

1. Manual entry or an existing saved chart; verify venue time/coordinates.
2. **Compare charts → Pin this chart**, then another event or Time explorer.
3. The general **Research notes** notebook versus captured **Event notes**.
4. Private **Export all** backups, reviewed imports and sharing exclusions.

The guide uses native collapsible details/summary semantics, keyboard focus and a
visible focus outline. It starts collapsed on page load and has no stored preference,
automatic note read or record write. Opening it expands a compact AstroEye panel
without changing event sky, chart selection or globe position. It contains no
animated transitions. Existing close/Escape behavior is unchanged.

## Current evidence

`npm run test:platform`: **461 passed**, zero failures/skips/TODOs, 42.192 seconds.
Script/runtime syntax and diff checks pass.

`npm run build` passes in 31.47 seconds, retaining the existing node:fs
browser-externalization and large-chunk warnings. No dependencies were changed.

The extended `node scripts/qa-astroeye-annotation-workspace.mjs` mounts the real
workspace/controller/note services with synthetic native IndexedDB records and a
mocked globe viewer. It now also verifies:

- Enter opens Quick start and focuses its summary; Space collapses it.
- Guide access leaves storage bytes unchanged and does not load the note collection.
- Keyboard Compare charts with no selection focuses the empty-state instructions;
  Saved events focuses its heading. With a selected chart, Compare charts focuses
  the comparison section and Pin this chart works by keyboard.
- The pinned first chart remains byte-for-byte the same displayed snapshot while
  the current event changes and a frozen event-note draft is saved.
- At 390 pixels the guide and workspace have no horizontal overflow; its screenshot
  was visually inspected at `qa-shots/astroeye-quick-start/narrow.png` (ignored).

Existing checks still cover note reload restoration, draft preservation across
selection changes, save without navigation, separate notebook preservation,
playback signals/delayed capture, marker delete/undo/import refresh and off-after-
reload behavior. Six embedded SVG icons are allowed; external/API requests remain
blocked. No user browser, user records or live providers were accessed.

The first browser run passed all assertions but **exited 1** after its 10-second
browser-close deadline; the owned-process fallback was invoked. The unit suite
was allowed to finish, then one serial retry ran with unchanged limits. The final
run **exits 0**, with graceful cleanup in **5.908 seconds**, no forced termination.
The whole-run watchdog is now 60 seconds (previously 120); shutdown limits were
not relaxed. This is one bounded retry, not a claim that shutdown timing is fixed.

## Remaining acceptance

This advances U1/U2 but closes neither: fixtures seed the two starting events via
the controller, use mocked map rendering and Director signals, and are not full
application bootstrap or actual embedded-host tests. It does not newly verify
provider-to-form review, the full manual form entry path, share restoration in a
fresh browser, file downloads, real cinematic playback, screen-reader behavior or
the complete reduced-motion/keyboard audit. Those criteria remain explicit.

Five release gates remain accepted and ten open. No change to calculation models,
saved-record schemas, source data, provider permissions or publication status.
Next: complete the remaining combined-workflow scenarios in bounded tests and
finish host-specific/manual evidence where automation is unavailable.
