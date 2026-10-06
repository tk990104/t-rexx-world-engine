# Voice provider response limits

October 5, 2026, checkpoint 134, based on `8f7d672`. Partial L2 security review;
not a live-provider or public-deployment acceptance.

Follow-up: [checkpoint 135](astroeye-voice-request-limits.md) separately bounds
HUD/diagnostic inbound body reads. The inbound-read limitation below describes
checkpoint 134; global connection/access controls still remain separate.

## Finding and correction

The OpenAI token and HUD-summary routes read successful provider responses without
an explicit application byte cap or request/body deadline. They also used fetch's
default redirect policy. Error redaction/no-store from checkpoint 131 did not
address these resource boundaries.

Both routes now use `server/voiceProviderResponse.js` with:

- **256 KiB maximum** response-body bytes before decoding/JSON parsing. Excessive
  Content-Length is rejected before reading; absent or understated lengths cannot
  bypass actual byte counting. A fixed buffer prevents an unbounded chunk list.
- **15-second deadline** covering fetch plus body reads together. Timeout aborts
  the transport and returns even if it does not cooperate with abort. A response
  arriving after timeout is canceled, not processed. The deadline is cleared when
  finished and is not restarted for individual chunks.
- **Redirect rejection** (`redirect: error`) on the fixed provider destinations.
- Reader cancellation/release on failure without waiting for cancellation
  acknowledgement. Provider error bodies are canceled but never read; their
  generic status/error behavior remains unchanged.

UTF-8 is decoded after assembly, preserving split characters and fetch-compatible
BOM handling. Successful token text and tier/model headers remain intact; HUD JSON
is parsed only after the bound. Oversized, timed-out or failed reads use the
existing generic 502/no-store fallback without credentials or provider diagnostics.
The next request may retry normally; failures are not cached or retried automatically.

These are application safety limits, not claimed provider limits or an overall
memory/CPU/billing guarantee. A valid but slower/larger reply is rejected. Already
sent upstream work may still incur charges despite cancellation. The deadline
begins at the upstream request; it does not time-bound the preceding client request
body read. Concurrency, browser-origin/access policy, request slow-send protection,
other proxies and deployment-wide limits still require review. Successful token
schema validation is unchanged; this is a size/time boundary, not a new API contract.

## Verification and scope

```text
node --test --test-concurrency=1 src/voice/voiceProviderResponse.test.mjs src/voice/openAiProxySecurity.test.mjs src/voice/astroeyeAcceptance.test.mjs src/voice/voiceDiagnostics.test.mjs
npm run build
```

Nine new helper tests cover byte/Unicode/BOM boundaries, redirect policy, declared
overflow without reads, actual overflow despite misleading headers, stalled fetch,
late response cleanup, stalled body/cancellation, unread upstream failures and
stream failure/retry. Four added route tests verify oversize/timeout failure and
retry for token/HUD in development and preview. All upstream traffic is synthetic,
with injected credentials. No real key or provider request is used by these tests.
All 43 focused tests pass, zero failures/skips/cancellations, 149.679s. This includes
existing command-envelope, error/cache and diagnostic-privacy regressions. Final
production-build results are recorded in the finish-line tracker.

Existing-key reuse remains as authorized; no credential or user-data changes,
microphone access, live API call, push, hosted CI, deployment or tag. Full/allocation
and browser suites are not rerun for this scoped server change. Earlier L1/hosted
CI acceptance is still for `eb1a716`, not subsequent local fixes.

Six gates accepted, nine open. Next: remaining access/origin and inbound-request
review; provider/data/asset rights and actual-host checks remain separate.
