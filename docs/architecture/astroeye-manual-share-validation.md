# Manual form to isolated shared-view check — incomplete

September 15, 2026 — checkpoint 80. Application candidate: **`73150ed`**.
Only a diagnostic QA script and documentation change; no application behavior,
schema, dependencies, user records or provider settings change.

## Scope

`node scripts/qa-astroeye-manual-share.mjs` mounts the real workspace, form,
controller, calculations and native IndexedDB in disposable sender/recipient
browser contexts. Both use the same synthetic database name, in isolated contexts,
so the recipient must start empty. The camera presenter is a mock that records the
navigation option; the shell's globe/camera restoration is not exercised.

The sequence covers manual form submission at New York's repeated 01:30 on
November 1, 2026: no save without an occurrence choice, explicit second occurrence
at 06:30 UTC, a -15 minute unsaved preview, private synthetic note/notebook data,
UI link generation, fresh-context restoration, exact chart/wheel agreement,
refusal to create a note from an unsaved shared event, explicit Save a copy, and
malformed-link rejection without changing the copied records. A local link stays
inside the isolated test; no clipboard use, public sharing or provider calls.

## Results and failed attempts

**This browser check is not accepted as passing.** Three bounded attempts were
made, then retries stopped:

1. The first attempt failed a navigation assertion. The mock incorrectly counted
   any chart-presentation call as navigation, ignoring `{ navigate: false }`.
   Source inspection confirmed the controller correctly passes that option on
   shared restoration. The mock was corrected and explicit false-option assertions
   added; no production fix was indicated. No clean-shutdown result was recorded
   for this attempt.
2. The corrected run completed **all workflow assertions**, reporting zero external
   requests and no user-data access, but **exited 1**: browser close exceeded its
   10-second deadline. Cleanup reported `process-still-running`, page close
   completed, forced owned-process fallback invoked, elapsed 10.169 seconds. This
   is partial functional evidence, not an overall pass or confirmed graceful exit.
3. Bounded sender-page cleanup was added, because the harness owns two pages while
   the shared helper explicitly closes one. The final attempt **exited 1 with no
   completion report**. The 60-second watchdog can exit this way; without phase
   telemetry that result does not establish where it stopped. The two-page cleanup
   change has therefore not been verified as resolving the problem.

After stopping retries, phase/error/watchdog diagnostics were added to the script.
The final diagnostic revision passes `node --check`, but **was not browser-rerun**.
Future watchdog output identifies the current phase without printing links,
record contents or credentials. It retains the 60-second whole-run limit,
3-second sender close and unchanged shared browser-close limit. Only its launched
browser process is eligible for fallback termination; user pages are never attached.
Do not add this diagnostic check to a passing CI gate until it exits 0 with normal
cleanup. Do not simply increase deadlines to treat an unresolved shutdown as success.

## Passing focused regression evidence

Windows, Node 24.20.0, current installed dependencies:

```powershell
node --test src/modules/astroeye/shareView.test.mjs src/modules/astroeye/workspaceController.test.mjs src/modules/astroeye/draftTimeSummary.test.mjs src/modules/astroeye/researchAnnotationRecovery.test.mjs
```

**42 tests pass**, zero failures/skips/TODOs, 24.994 seconds. These cover share
allowlists, invalid inputs, repeated-hour/time previews, explicit save-copy,
stale restoration and annotation recovery/privacy. Source/diff syntax checks pass.
The full platform suite and production build were not rerun: application code is
unchanged from checkpoint 79, which records its separate 461-test/build results.

## Next bounded investigation

First obtain phase evidence or split sender, recipient and teardown into separately
bounded diagnostic cases. Preserve this failure history. Complete a passing run
before treating the manual/share sequence as U1 evidence. Full main bootstrap,
actual world/camera restore, provider-to-form review, real Director playback and
embedded-host checks remain separate and unverified by this fixture.

No gate closes: five remain accepted and ten open. Nothing was published or deployed.
