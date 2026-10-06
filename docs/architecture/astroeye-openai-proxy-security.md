# AstroEye OpenAI proxy error and cache boundaries

October 5, 2026, checkpoint 131, based on `e7031c1`. Partial L2 review, not
live-voice or public-deployment acceptance. The user approved reusing the existing
key; no credential file was changed and tests use an injected synthetic key.

## Confirmed code gaps and correction

The Realtime token handler forwarded upstream failure bodies verbatim and did not
set Cache-Control. Both it and the HUD-summary handler returned thrown error
messages; HUD also forwarded provider error messages. These paths could expose
provider diagnostics containing credentials or private request context. This is a
code finding, not evidence that a real credential was leaked.

Both routes now set **Cache-Control: no-store** before method/configuration/rate
checks, including success and every failure branch. The missing-key response is
still 501 with `disabled: true`, but no longer publicly cacheable.

Upstream failure bodies are canceled without reading, parsing or forwarding them,
and without waiting for cancellation acknowledgement. Only fixed application
errors are returned. HTTP 4xx/5xx status is preserved; other unsuccessful status
values become 502. Thrown request/parse/transport/read errors are generic 502s.
Malformed or empty successful HUD replies now fail explicitly rather than
producing a 200 with no usable summary. Successful HUD output keeps its existing
five-word normalization and excludes unrelated response fields.

Successful token bodies remain untouched: the browser intentionally needs the
short-lived credential. Tier/model headers and unknown-tier fallback remain
unchanged on success. No session tools, instructions, models, prices, request
payloads or microphone behavior were changed. This is not an allowlist or redaction
of successful token bodies; provider trust and response validation remain separate.

The plugin exposes injected fetch/environment/rate-limit dependencies for offline
tests; production defaults remain the existing fetch, process environment and
opt-in rate limiter. No config factory or env-file loader is invoked by the new
tests. They neither read the real key nor call a network provider.

## Verification

All **83 focused tests pass**, zero failures/skips/cancellations, 35.760s.
Eighteen added tests exercise the real installed handlers in both development and
preview: temporary-token delivery, tier fallback, unread/canceled error bodies,
stalled cancellation acknowledgement, transport/read failures, missing keys,
method rejection, throttling, HUD output fields, and malformed input/output.
Existing command-envelope, cost-accounting and fallback tests also pass.

```text
node --test --test-concurrency=1 src/voice/openAiProxySecurity.test.mjs src/voice/astroeyeAcceptance.test.mjs src/voice/voiceCost.test.mjs src/voice/voiceFallback.test.mjs
npm run build
```

Production build: 261 modules, 28.45s, existing node:fs browser externalization
and large-chunk warnings. No full/allocation/browser suite rerun or live voice
session; no user-record access, paid API call initiated by tests, microphone use,
push, hosted CI, deployment or release tag. Earlier L1/CI acceptance is for
`eb1a716`, not these local changes.

## Remaining review items

- Diagnostic recording: `/api/realtime/debug-log` still writes submitted records
  to the local JSONL log. Client sanitization is not a server trust boundary;
  consent, server validation, retention and error disclosure need review. No logs
  were opened, deleted or changed in this checkpoint.
- Cost-bearing endpoints retain opt-in throttling, no added authentication, and
  existing method/path behavior. Public exposure requires an explicit access and
  origin policy; these changes do not make an unauthenticated deployment safe.
- Upstream success response-size/deadline/redirect policy and remaining routes
  still need review. Error redaction is not a resource-usage bound.
- Provider/data/asset/recording rights and target-specific approval remain open.

Six release gates accepted, nine open. L2 remains incomplete. Next bounded slice:
diagnostic-recording privacy controls; live voice and actual-host note-marker checks
remain separate and must not be inferred from offline proxy tests.
