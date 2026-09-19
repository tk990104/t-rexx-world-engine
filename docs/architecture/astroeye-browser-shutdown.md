# Owned test-browser shutdown diagnostics

September 19, 2026, checkpoint 109, from `336aa78`. Tooling only; application
runtime, user browser settings and saved research are unchanged.

## Investigation and limits

The repeated venue/workspace cleanup failures reported `processExited: false`
before requesting termination. They were not merely classified as slow temporary
profile removal after an already-exited process. The original root cause has not
been reproduced or conclusively identified in this checkpoint.

`scripts/qa-browser-shutdown-probe.mjs` launches a blank temporary browser, never
attaches to a user profile and loads no app. It records disconnection, process exit
and stdio closure without logging profile paths or environment variables. Its
45-second watchdog targets only its launched browser. Optional `--pipe` compares
the installed Puppeteer's connection modes without changing any app settings.

Both baseline probes using Chrome 145.0.7632.77 exited gracefully: WebSocket cleanup
7.359 seconds, pipe cleanup 7.948 seconds. Both showed several seconds between
disconnection and process exit. These two samples do not establish a transport
advantage or explain the earlier timeouts; no connection-mode change was made.

## Reliability improvement

The shared helper now reports page-close duration, browser-close duration,
disconnection and process-exit milestones. Its observation listeners are removed
on every return, preserving other listeners. Puppeteer's removable `on/off` pair
is used instead of relying on its wrapped `once` handlers.

Previously a successful `process.kill()` return was the last recorded fallback
evidence. Now an owned-process exit is observed for at most one additional second:
`forcedExit` distinguishes `observed`, `timeout` and `not-requested`, while
`processExitedAfterCleanup` records the final process state. The original status
and `processExited` remain the pre-fallback snapshot for compatibility. A confirmed
forced exit is never promoted to graceful shutdown or profile-cleanup success.
No process enumeration, broad termination or manual profile deletion is introduced.
Page and browser close limits remain 3 and 10 seconds; no existing timeout was raised.

## Verification

- All 12 helper tests pass (0.454 seconds), including observed/missing/refused
  forced exit, listener cleanup/isolation, ownership and invalid bounds.
- Two consecutive isolated venue-dismissal runs pass every functional assertion
  and exit 0 with graceful cleanup. Cleanup durations are 0.730 and 5.357 seconds;
  both confirm browser-process exit and completed Puppeteer close, with no forced
  termination, page errors, app bootstrap or user-data/provider access.
- Syntax and whitespace checks pass. Application build, platform/full-repository
  and allocation suites were not rerun because application code is unchanged.
  Checkpoint 108's build remains historical evidence, not a new build claim.

The variability and earlier forced-cleanup runs remain documented. This is better
diagnosis and bounded exit confirmation plus two fresh clean venue runs, not a
universal shutdown fix, embedded-host certification or a new release-gate acceptance.
The separate port-5175 server was stopped; nothing was published. Five gates remain
accepted and ten open.
