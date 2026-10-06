# Incoming voice-request body limits

October 6, 2026, checkpoint 135, based on `15a6a57`. Partial L2 review;
not public-deployment or live-provider acceptance.

## Finding and correction

The existing body reader enforced a size cap but collected chunks in an array,
had no deadline, and did not explicitly settle on aborted/prematurely closed
requests. The token/HUD upstream deadline from checkpoint 134 begins after upload,
so it could not protect the earlier inbound read.

HUD-summary and enabled diagnostic uploads now use `server/voiceRequestBody.js`:

- One **10-second whole-read deadline**, not reset by incoming chunks.
- A fixed buffer at the existing route cap: **64 KiB for HUD**, **4 KiB for diagnostics**.
- Excessive declared Content-Length rejected before data listeners are attached;
  actual bytes always counted, including absent/understated length headers.
- Abort, stream error, premature close, overflow or timeout reject once and
  destroy the incomplete request. Owned listeners and the timer are removed.
- Successful completion preserves split UTF-8 and empty-body behavior, removes
  owned listeners/timer, and does not destroy the completed request. Unrelated
  listeners remain untouched.

Incomplete requests fail before the provider call or diagnostic append. Closing
the request also closes its real HTTP connection: a client may see a network/reset
error rather than receive the route's attempted generic JSON error. This is
intentional to stop the unfinished upload, not a claim of a reliable HTTP 4xx/5xx
response for destroyed sockets. Clients can issue a new valid request normally.

## Scope and remaining boundaries

Only HUD-summary and diagnostic body reads change. The token endpoint does not
parse a client body; its method/access behavior is unchanged. The separate
OpenRouter body reader and other proxy routes remain unchanged. Server-global
header/request/connection limits, concurrency, unused bodies on early rejection,
access/origin policy and deployment-specific authentication remain separate work.
These local per-read bounds do not make a public unauthenticated deployment safe.

Key selection, provider models, recording opt-in, saved records, existing logs and
browser history are unchanged. No credentials were read or changed for the tests.
No live provider call, microphone use, user-data access, push, hosted CI, deployment
or tag. Previous L1/CI acceptance remains scoped to `eb1a716`.

## Verification

```text
node --test --test-concurrency=1 src/voice/voiceRequestBody.test.mjs src/voice/openAiProxySecurity.test.mjs src/voice/voiceDiagnostics.test.mjs
npm run build
```

New tests use in-process Node streams and synthetic credentials. They cover exact
byte/Unicode boundaries, empty input, unrelated-listener preservation, overflow,
stalls/trickles, abort/error/close, already-aborted requests, timer cleanup, no
provider call on failed HUD input, valid retry in dev/preview handlers and no
diagnostic write after interruption. They do not open the actual diagnostic file,
make an external request or claim a real-browser slow-upload test. Final counts
and build results are recorded in the finish-line tracker. All 44 focused tests
pass, zero failures/skips/cancellations, 49.828s, including 11 new inbound cases.
The full repository, allocation and browser suites were not rerun.

Six gates accepted, nine open. L2 still requires access/origin and remaining-route
review plus provider/data/asset rights decisions. Next bounded slice: browser-origin
checks for the cost-bearing routes, without assuming deployment authorization.
