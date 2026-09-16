# Checkpoint 98 — Windows source tests and Director focus restoration

September 16, 2026. Baseline: checkpoint 97 (`c16084f`). The prior full repository
run had 3,273 passes and 25 failures. This checkpoint resolves that failure set
without changing the voice schema, weakening its frozen hash, or changing Git's
checkout settings.

## Cause and scope

- 24 failures were source assertions expecting LF in Windows CRLF/mixed source
  reads. Twelve affected test files now use explicit test-only `readSourceSync`
  or `readSource` helpers. They canonicalize CRLF to LF and preserve everything
  else: spaces, tabs, final newlines, BOM and lone carriage returns. There is no
  global filesystem monkey-patch or production source rewrite.
- The base voice tool array still has its frozen LF length of 31,104 and SHA-256
  `3ace199727934e851902e4899c423d549d34d3f53469dcb56f07fc070d3f9d66`.
  The test now names that exact scope and checks the closing delimiter explicitly.
  It is not a claim that the composed AstroEye voice transport has no added tools.
- One Cockpit assertion assumed `_running = true` was immediately followed by
  the playback CSS class. Existing focus capture sits between them. The assertion
  now explicitly requires that capture in the same ordered sequence rather than
  accepting an arbitrary gap.

## Director accessibility correction

New behavioral tests execute the real Director start/finish lifecycle against
controlled browser doubles. They exposed focus restoration occurring while Start
was still disabled by playback. `_finishRun` now finishes run bookkeeping and
re-enables controls before returning focus. Disconnected original controls are
still skipped. The camera, shot timing, scene serialization and layer behavior
are unchanged.

Three cases cover normal completion, cancellation, and cancellation after the
original control has been removed. Stop is enabled and playback mode active before
focus enters it; a connected Start is enabled and playback mode has ended before
focus returns. Test cleanup stops pending runs and restores browser globals.
Four helper tests cover LF/CRLF/mixed equivalence, meaningful-content preservation,
path/URL sync/async reads without file mutation, and missing-file error propagation.

## Verification and remaining work

All 412 focused tests pass (16.452 seconds), including the original failing set,
the helper tests and Director lifecycle coverage. Production build passes with
257 modules in 8.11 seconds, retaining existing node:fs externalization and
large-chunk warnings. Full `npm test` exits 0 on Node 24.20.0: all 3,305 ordinary
tests pass (125.893 seconds), the focus allocation test passes (5.273 seconds),
and all 13 overlay allocation workloads pass (175.443 seconds). Total: 3,319
passed, zero failed, cancelled or skipped. The original allocation budgets,
warmups, cohort sizes and 180-second per-worker timeout were not relaxed.

No actual embedded-host Director focus or reduced-motion preference certification
is claimed in this checkpoint. No microphone, live voice command, saved-record
edits or publication. Five release gates remain accepted and ten open. Next:
actual-host keyboard playback review and a Director reduced-motion policy that
preserves authored scene timing and explicit user control.
