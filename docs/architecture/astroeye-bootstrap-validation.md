# Full-bootstrap validation — checkpoint 66

Status: **incomplete, not acceptance evidence**. Runtime remains `19b642f`.

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
