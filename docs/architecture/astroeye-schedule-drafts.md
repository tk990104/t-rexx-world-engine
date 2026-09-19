# Preserve manual edits during venue lookup

September 19, 2026, checkpoint 112, from `6c9853b`.

Event-form input and change events now cancel an in-flight provider selection,
abort its request and invalidate its generation. Late success/failure cannot
populate the form or replace the cancellation message. Read-only schedule searches
are unaffected. A fresh explicit game selection still authorizes a new handoff.
The schedule status explains that edits were preserved and how to retry. No saved
record schema, review requirement or calculation behavior changes.

## Evidence and limitations

- All 44 focused tests pass (25.754 seconds), including six new lifecycle/wiring
  tests for late success/failure, discovery exclusion, newer-selection isolation,
  disposal and both form event types. The DOM seam is deliberately minimal and
  does not certify actual rendering or focus.
- Production build passes: 261 modules, 2m 57s, with existing node:fs and
  large-chunk warnings. Diff-whitespace check passes.
- New `--draft-conflicts` mode of `qa-astroeye-provider-workspace.mjs` adds eight
  full-workspace scenarios across text, date, select and checkbox edits, plus
  discovery and explicit retry. Its fetch fixture deliberately ignores aborts
  to exercise stale-result protection. It uses disposable IndexedDB and synthetic
  responses, with the existing explicit `--node-assets` diagnostic relay.
- Browser verification is **incomplete**: attempt one exceeded the 20-second
  workspace-mount cap before assertions; cleanup requested forced exit but did
  not observe exit within its bound. One retry reached draft-conflicts then
  cleanup at 53.094s, but the 60-second watchdog stopped the run before a result
  was emitted. The assertion outcome is unknown, not a pass. The harness now
  emits validation results before cleanup for future runs; that reporting-only
  change was not browser-rerun. No additional browser retries this checkpoint.

Local file operations were also unusually slow; the patch tool reported an error
after runtime edits landed. Direct diff inspection verified the exact edits;
they were not reapplied. The underlying local slowdown is not diagnosed.

The user's preview was restarted on port 5173 and returned HTTP 200. The app
queued opening its browser panel; visual verification failed at browser-tool
initialization (missing kernel assets). Preview remains running by request.
The separate port-5175 test server was stopped. No user records were edited or
published. Platform/full/allocation suites were not rerun. Five gates remain
accepted and ten open; U2 and browser draft-conflict acceptance remain open.
Next: rerun this bounded browser mode when the local host is responsive, using
the new pre-cleanup validation output before drawing conclusions.
