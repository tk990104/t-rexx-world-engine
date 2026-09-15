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

## Checkpoint 81 — startup stall isolated, failed-mount cleanup repaired

September 15, 2026. Based on diagnostic candidate `b02c6e5`; application runtime
remains `73150ed`. This section supersedes only the next-investigation guidance
above, not its failure history or incomplete full-workflow status.

The first phase-instrumented run failed at **sender-mount**, reporting failure to
fetch the dynamic workspace module. It also revealed a harness ownership gap:
`sender` was assigned only after `open()` finished mounting, so a failed mount left
the created page unavailable to explicit page-first cleanup. Its browser close
timed out (10.130 seconds) and invoked the owned-process fallback.

A subsequent read-only request to the module URL returned HTTP 200, JavaScript,
310,081 bytes. This shows that endpoint was available at that moment, not that
every dependency was available or that the original fetch failure is explained.

The test now retains each owned page immediately after creation, before navigation
or imports. It records timestamped stages and bounded failed-request/status data,
without query strings, links, private records or credentials. One instrumented
run reached all workflow assertions, but its stricter asset check found a 404 for
the fixture's favicon. Both pages and browser then closed normally (1.053-second
shared cleanup, sender close completed, no force). An inline fixture icon removes
that unnecessary request; it does not change the application's assets.

The next full attempt hit the 60-second watchdog entering recipient-mount. Timings
show sender startup consumed most of the budget: manual-form was reached only at
58.189 seconds, and recipient-mount at 59.941 seconds. No failed asset requests
were recorded. This is **startup latency**, not evidence that this attempt stalled
at shutdown; its underlying cause remains unresolved.

### Smaller diagnostic and current result

`node scripts/qa-astroeye-manual-share.mjs --mount-only` now isolates one empty
synthetic workspace. Mount evaluation has its own **20-second timeout**, within
the unchanged 60-second overall watchdog. Substages distinguish workspace import,
other service imports, setup, opening and shared restoration. The timeout does not
cancel JavaScript in place; page-first cleanup closes the owned page afterward.

The focused run reports workspace import at 4.883 seconds, then the mount timeout
at 24.863 seconds. It never reaches service imports or storage/workspace setup.
No failed HTTP requests are recorded. Exit is **1**, with **graceful cleanup**:
sender close completed, browser close completed, process exited, no force;
shared cleanup took 4.243 seconds. Thus the stall is localized to importing
`astroeyeWorkspace.js` or its dependency graph/evaluation, not the note save or
share algorithms. A 200 response for the top-level module does not distinguish a
pending dependency fetch from slow evaluation or a renderer delay.

All **six owned-browser cleanup unit tests pass** (0.583 seconds), and final
script syntax/diff checks pass. A wrapper syntax typo was caught by `node --check`
and corrected before the focused browser run. No application changes, new build,
full-suite rerun, user-profile access or publication occurred. The 42 focused
application tests in checkpoint 80 remain prior evidence, not a new rerun.

The failed-mount cleanup path is now verified, but **the full manual/share check
still has no accepted passing run**. Next: inspect pending dependency requests
versus module evaluation using the mount-only case before repeating the two-party
workflow. Do not extend the deadlines or infer an app-data defect from this result.
Five gates remain accepted and ten open.
