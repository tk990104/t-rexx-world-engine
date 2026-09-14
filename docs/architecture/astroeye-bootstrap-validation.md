# Full-bootstrap validation — checkpoints 66–67

Current status: **offline full-bootstrap assertions pass; V3 remains open**.
Runtime remains `19b642f`. The checkpoint-66 failure history below is retained.

## Checkpoint 67 — diagnosis and passing offline run

The saved diagnostic distinguished initialization from restoration: the document
was complete, the app object existed and the loading cover was hidden, but free
voice was absent and the caught initialization-error flag was set. The speech
mock lacked `addEventListener`; production `loadVoice()` registers a
`voiceschanged` listener when the initial voice list is empty. Making the mock
an EventTarget allowed initialization to finish without production changes.

Additional harness corrections:

- Count intercepted `/api/realtime/debug-log` requests separately from token/model
  attempts. The existing local endpoint writes diagnostics, not provider requests;
  QA responds 204 before it reaches the server and does not read or persist bodies.
- Force a fresh document via `about:blank` before each startup. Navigating between
  map fragments had reused the existing app, so it did not test the second config.
- Observe the actual configuration response rather than resource-timing entries.
- Install browser mocks only on the app origin: neutral blank documents have no
  `mediaDevices`. Earlier neutral-page mock failures produced two page TypeErrors.
- Keep error diagnostics sanitized to categories and source-file frames, with
  stage/timing output for each real app-ready transition.

Final run in **Chrome 145.0.7632.77 exited 0**. Both genuine startups passed
(50.698 seconds browser-voice, 27.563 seconds configured Realtime). All seven
commands, Director refusal, real rendered chart/time controls, exact local voice
open/close, microphone-error stop/retry, manual reset and byte-identical synthetic
records across reload passed. No uncaught page errors remained. Counts: **0 voice
provider requests**, **3 local diagnostic requests intercepted**, **15 external
page requests blocked**, no native microphone use.

**Cleanup caveat:** normal browser close exceeded 3 seconds; the harness terminated
only its owned browser process and reported `browserCleanupForced: true`. This run
does not certify graceful browser teardown or performance in the embedded host.
The overall watchdog remained 150 seconds; it was not triggered.

All **16 focused voice/fallback/parity tests pass** (22.996 seconds), with no failures,
skips or TODOs. Syntax and diff checks pass. No production code changed, so no new
build or full 788-test run was performed. Checkpoint 64's build and checkpoint 65's
full suite remain historical evidence for the unchanged runtime.

This supplies offline full-bootstrap evidence, not V3 acceptance: embedded-host,
graceful teardown and explicitly authorized live-provider checks remain. A3/V1/V2
remain accepted; twelve release gates remain open. No user-preview interaction,
user-record access, credential change, live provider call or publication occurred.

## Checkpoint 66 — initial harness and failure history

`scripts/qa-astroeye-bootstrap.mjs` loads the real index, main module and Cesium in
a fresh temporary Puppeteer profile. Unlike the command harness, it does not replace
the document with a synthetic mounting page. It does not attach to the user's preview.

The planned assertions cover both startup configurations, all seven registered
commands, browser-voice dispatch, Director refusal, manual time reset after simulated
microphone denial, and byte-identical synthetic records across commands and reload.
These interaction assertions have **not yet been reached or verified**.

## Isolation and bounds

- Intercept same-origin `/api/` requests before the development proxy: mock only the
  configuration response; return 503 for others and count voice-provider attempts.
- Abort external page requests, bypass service workers, and replace speech recognition,
  speech output and `getUserMedia` before application startup. Allow only loopback
  Vite HMR sockets; application feed sockets are stubbed closed.
- No real microphone, provider authentication, user-profile access or user-record reads.
- Allow only a loopback QA base URL. Overall watchdog: 150 seconds; navigation:
  60 seconds; app readiness: 25 seconds; browser close: 3 seconds, then terminate
  only the process owned by the test. This is a test isolation boundary, not a
  system-wide network sandbox or a production privacy certification.
- Failure diagnostics contain error names and local module paths without query
  strings, not credentials, transcripts or saved record contents.

## September 14 execution evidence

The local server returned HTTP 200 for the index. Initial 25-second navigation
attempts timed out. A diagnostic attempt showed pending local JavaScript modules,
document state `interactive`, no app object and no uncaught page errors at that
point. A test-only HMR omission was tried and removed; the final harness retains
the real Vite client and permits only its local HMR socket.

With a 60-second navigation allowance, navigation completed, but the following
25-second combined app/voice/loading-cover readiness check timed out. The run exited
1. This does not establish whether initialization stalled, failed gracefully, or
simply exceeded the test window. No interaction assertion passed in this run.
Additional readiness-state diagnostics were added after that run and have not yet
been executed. Syntax validation passes; production files are unchanged.

No more browser retries were made in this checkpoint. The next diagnostic should
distinguish slow module delivery, initialization errors, and an awaited map startup
under blocked feeds before changing application code or extending timeouts again.
The existing 788-test and checkpoint-64 build results are historical evidence for
the unchanged runtime, not fresh results from this checkpoint.

V3 stays open. Embedded-host and explicitly authorized live speech/provider checks
are also still required; generic continuation does not authorize those live calls.
