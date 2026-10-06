# Google Places request safeguards

October 6, 2026, checkpoint 140; based on `913447b`. Implements F1 in the
route inventory. **Not whole-L2 acceptance or provider-rights clearance.**

Both `/api/google/nearby-places` and `/api/google/text-search` now share:

- A local-browser guard before input, throttle, key lookup or provider work.
  Loopback peer/Host/socket port and same-origin evidence are required, using the
  existing reviewed predicate. Every failure retains `{ error, places: [] }`;
  access denials close the connection. Remote/custom-host calls fail closed.
- GET-only operation and `server/googlePlacesRequest.js` input validation. Latitude
  and longitude must be present finite decimals within geographic ranges. Zero
  remains valid; missing/blank values no longer coerce to zero. Duplicate/unknown
  parameters, nondecimal/nonfinite numbers and nonpositive radii are rejected.
  Numeric fields are limited to 32 trimmed code units; text search requires one
  nonblank `q` of at most 500 trimmed UTF-16 code units.
- Existing positive-radius clamping/defaults: nearby 25–5000 m, default 250 m;
  text 50–50000 m, default 4000 m. The fixed endpoints and field masks are unchanged.
- The shared provider reader enforces a **256 KiB actual-byte cap**, one
  **15-second fetch/body deadline**, redirect rejection and canceled/released
  responses on failure. Non-OK upstream bodies are never parsed or forwarded.
- Generic errors and `Cache-Control: no-store` on all failure paths, including
  access, input, method, key absence, rate limiting, malformed response, transport
  failure and upstream error. Safe 4xx/5xx status is retained; other failure statuses
  map to 502. Invalid JSON/payloads do not masquerade as successful empty results.
- Successful empty `{}` responses remain valid. Place normalization, nearby
  ranking/deduplication and text-search viewports remain; nearby returns at most
  20 places and text at most 5 even if an upstream ignores the requested count.
  Success still uses the existing private five-minute cache header.

The plugin injects environment, fetch, throttle and timeout dependencies only for
testing. Production defaults are unchanged. No actual key or restriction was
read/changed, and Google Maps client key injection remains as before.

## Verification

```text
node --test --test-concurrency=1 src/data/googlePlacesProxySecurity.test.mjs src/voice/voiceProviderResponse.test.mjs src/voice/voiceRequestAccess.test.mjs src/annotations/annotationResolver.test.mjs
npm run build
```

All **63 tests pass**, zero failures/skips/cancellations, 12.836 seconds. This
includes 31 new parser/route cases across both dev and preview hooks plus reused
stream/access and annotation-resolver regression coverage. Cases cover malformed,
missing, duplicate, out-of-range and oversized input; early denial before keys;
status/cache/error shape; unchanged valid request fields; normalized results;
unread upstream errors; actual-byte overflow with false Content-Length; stalled
fetch/body; cancellation and successful retry. Build result is in the tracker.

Tests use mock providers and in-process requests, not browser/wire-level or live
Google acceptance. No full/allocation suite, microphone, user-data/log access,
provider call, key write, push or deployment. Existing Node/fs and bundle-size
build warnings are tracked separately, not fixed by this server change.

This is not public authentication, a concurrency/billing cap, or a guarantee
against a native local client forging headers. Global URL/header/connection
limits and disconnect propagation remain S3 work. Existing client-side requests
may time out sooner than the server deadline. Map/provider recording, storage
and account-rights decisions remain open: preserving an old success cache policy
is not a fresh legal clearance. F2 (GBFS) is next, followed by F3–F5. Six release
gates accepted, nine open; prior hosted CI still applies to `eb1a716`.
