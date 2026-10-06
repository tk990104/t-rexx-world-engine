# GBFS transport safeguards

October 6, 2026, checkpoint 141; based on `6f3a063`. Implements route-inventory
F2 for the bike-share proxy. This does not close the whole L2 release gate.

## Implemented boundary

- Existing GET, HTTPS hostname allowlist (including `*.publicbikesystem.net`)
  and station-information/status path checks remain. Targets containing credentials
  or nonstandard ports are rejected before fetch; explicit HTTPS port 443 remains
  valid. Redirects are rejected, not followed to a new destination.
- `server/gbfsResponse.js` applies the GBFS-specific **5 MiB actual-byte cap** and
  one **12-second fetch-and-body deadline**. Declared length is an early check,
  never a substitute for streamed byte counts. A fixed-size buffer avoids joining
  unbounded chunks. UTF-8 decoding retains fetch-text BOM behavior.
- Oversized/failed/stalled streams are aborted, canceled and released. Cleanup
  does not wait indefinitely for cancellation acknowledgement. A late response
  from an abort-insensitive fetch is canceled without reading it.
- Non-OK bodies are canceled unread. Safe 4xx/5xx status is retained; unexpected
  failure statuses map to 502. Timeout returns 504, overflow 502. All failures
  have fixed messages and `no-store`; raw transport exceptions are not logged by
  this route. Success is served as JSON, not an upstream-controlled HTML MIME type.
- Valid feed text is otherwise unchanged, with the existing information-feed
  five-minute cache, status-feed `no-store`, and upstream/cache metadata headers.
  Empty success responses remain supported. This is not GBFS schema validation.
- Dev and preview install the same handler explicitly (preview previously used
  the existing `alsoServeInPreview` adapter). No new mount is introduced.

## Verification

```text
node --test --test-concurrency=1 src/data/gbfsProxySecurity.test.mjs src/data/bikeshare.test.mjs src/data/googlePlacesProxySecurity.test.mjs
npm run build
```

All **52 tests pass**, zero failures/skips/cancellations, 10.603 seconds: 19 new
transport/route tests, two bike-share UI contract regressions, and 31 Google Places
regressions. Coverage includes exact-cap split UTF-8, missing/false Content-Length,
multi-byte overflow, stalled fetch/body, cancellation/release, late completion,
unread upstream failures, redirect policy, invalid targets and successful retry
in both dev/preview hooks. Production build result is recorded in the trackers.

All providers are mocked. No live feed calls, user data/key changes, microphone,
browser/full/allocation suite, push or deployment. Hosted CI remains tied to
`eb1a716`, not this local candidate.

## Remaining limits

This is a per-response cap, not a global memory, concurrency or rate limit. Client
disconnect propagation, whole-server exposure policy and DNS/address validation
remain in S3/F5; hostname allowlisting is not proof that an approved hostname
cannot resolve to a private address. No authenticated public-service claim or
provider-rights clearance is added. Other route lifecycles remain F4 work.

F1 and F2 are implemented; F3 (remaining raw failures), F4 (remaining response
bounds) and F5 (method/access policy) remain. Overall: six accepted release gates,
nine open. Next bounded slice is F3's raw error paths, not new AstroEye features.
