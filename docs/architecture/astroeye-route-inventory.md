# AstroEye server route and credential inventory

October 6, 2026, checkpoint 139; source candidate `dba552c`.
**S2 inventory complete; remediation and L2 acceptance remain open.**
Six release gates accepted, nine open. This is a static inventory and triage,
not a penetration test or certification of every inherited helper.

## Scope and counting

The active Vite plugin list installs 30 literal application API mounts in
`vite.config.js`, plus `/api/astroeye/sports` dispatched by
`server/sportsScheduleProxy.js`: **31 mounts**, not 31 distinct methods/subroutes.
For example, OpenRouter has status/chat and CCTV has several subroutes.
`alsoServeInPreview` supplies missing preview hooks, so these plugins are not
development-only merely because their source names `configureServer`.

The count excludes Vite/Cesium internal asset, HMR and static-file serving, and
the pathless `productionHeaders` middleware. These still matter to deployment;
this count must not be represented as the whole HTTP attack surface.
No config factory was executed, env file opened or live endpoint called for this
inventory. Source registration/handler reading is the evidence.

## Mount coverage

All rows except sports refer to `vite.config.js`; sports refers to the server
file above. "Observed" means inspected source, not a fresh successful test.
F1–F5 below are finite finding groups, not additional release gates.

| Mount | Observed boundary / review disposition |
| --- | --- |
| `/api/adsbdb` | Identifier lookup and cache; 8-second fetch signal, successful `res.json()` without a streaming cap; raw catch text. F3/F4/F5. |
| `/api/adsblol/mil` | Fixed upstream and cached success; fetch has no explicit deadline here, buffers `.text()` and forwards non-OK body. F3/F4/F5. |
| `/api/adsblol/trace` | Validated hex, shared capped-response/12-second track helper and generic catch. Method/redirect/overflow-status behavior needs targeted review under F4/F5. |
| `/api/airports` | Compiled local dataset, ETag/revalidation. No per-route method gate observed; no provider credential in this handler. F5, not a live-provider byte-limit finding. |
| `/api/ais-live` | Reads shared upstream-websocket state; outer failure can return exception text. Subscription/bounds/concurrency helper behavior not freshly certified. F3/F5, S3. |
| `/api/astroeye/sports` | GET and date/venue allowlist, fixed provider path, 12-second signal, 2 MiB stream cap, cache/in-flight/rate controls and generic errors. Reuse checkpoint 129 evidence; no local-origin wrapper. F5. |
| `/api/cctv` | Server catalog IDs for sources/health/stream/media/frame, not an arbitrary client URL relay. Health metadata retains media exception text; media lifecycle/destination helpers need targeted follow-up. F3/F4/F5. |
| `/api/celestrak` | Group validation, fixed upstream, 20-second signal; `.text()` not byte-capped here; outer catch returns exception text. F3/F4/F5. |
| `/api/firms` | Keyed/keyless paths, caches and timeouts; keyless source summaries include exception text. Archive/body bounds and method policy need follow-up. F3/F4/F5. |
| `/api/gbfs` | GET, HTTPS host/path allowlists, advertised 5 MiB limit; limit is post-buffer and fetch timeout clears at headers. F2/F5. |
| `/api/geocode` | GET, regional helper with response-cap/timeouts, normalized output. Inventory done; helper/destination/access review remains F5, not new certification. |
| `/api/google/nearby-places` | GET and optional per-IP throttle; keyed fixed endpoint, finite-only coordinates, no explicit fetch/body bound, raw error text. F1. |
| `/api/google/text-search` | GET and optional per-IP throttle; query plus finite-only coordinates, no explicit fetch/body bound, raw error text. F1. |
| `/api/launches` | GET, fixed Launch Library endpoint, 20-second signal, capped body and cache/coalescing. Optional token. Retain existing evidence; F5 exposure review. |
| `/api/military-installations` | GET, structured regional request and capped response helper (16 MiB constant). Retain existing evidence; F5 exposure review. |
| `/api/openai/hud-summary` | Local-origin guard, POST, 64 KiB/10-second upload, 256 KiB/15-second upstream and generic errors. Reuse checkpoints 131–136. |
| `/api/openrouter` | Guarded status GET/chat POST, upload/response caps and shared 30-second fallback budget, generic errors. Reuse checkpoint 138; disconnect cancellation/concurrency remains S3. |
| `/api/opensky` | Fixed provider/auth modes, cache/cooldown and capped regional fallback. Do not infer the primary snapshot/OAuth path inherits the fallback cap. F4/F5. |
| `/api/opensky-track` | Validated ICAO and shared capped-response/12-second track helper; optional OAuth. Method/redirect/overflow-status review F4/F5. |
| `/api/overpass` | POST, capped request (24 KiB), restricted query handling, capped response helper (32 MiB), fixed mirrors. Upload deadline and exposure review F4/F5. |
| `/api/radio` | Stations GET and catalog-known click POST; allowlisted directory transport, 4 MiB response constant. Existing DNS/redirect controls recorded separately; broadcaster playback is direct, not this proxy. F5. |
| `/api/realtime/debug-log` | Local-origin guard, POST, explicit diagnostic opt-in, 4 KiB/10-second upload and 256 KiB metadata-only file cap. Reuse 132/135/136; old logs preserved. |
| `/api/realtime/token` | Local-origin guard, GET/POST, no-store, bounded upstream and generic failures. Reuse 131/134/136; not public authentication or a spend cap. |
| `/api/regional-brief` | GET, regional helper/caps and normalized news/geocode/weather assembly. Existing policies are not freshly cleared; F5 plus rights ledger. |
| `/api/route` | Restricted route construction and 8 MiB response helper. Method, redirect and overall lifecycle review F4/F5. |
| `/api/safety` | Local compiled payload with revalidation; raw catch error returned. F3/F5. |
| `/api/shootings` | Local compiled payload with ETag; raw catch error returned. F3/F5. |
| `/api/temperature` | Grid/cache plus forecast subroute; forecast fetch/JSON has no explicit deadline/cap here; raw outer catch text. F3/F4/F5. |
| `/api/terrain/heights` | Parsed bounded point list and cache; outer catch embeds exception text. Terrain helper lifecycle not fully audited. F3/F4/F5. |
| `/api/tomtom` | Validated tile coordinates, cache/budget governor, fetch timeout and generic failures; `.arrayBuffer()` has no byte cap here. F4/F5. |
| `/api/weather-effects` | GET, weather helper with 512 KiB response constant and timeout path. Retain evidence; F5 exposure review. |

## Prioritized fixes and exact stopping conditions

1. **F1 — Google Places pair (next coding slice).** Both keyed handlers call
   `fetch` without a signal/redirect policy, then parse unbounded JSON and forward
   provider/exception messages. Non-OK responses also receive the success cache
   policy. Missing coordinates become zero through `Number(null)` and geographic
   ranges are not checked. Add local access checks, explicit input validation,
   capped whole-response timeout, redirect rejection, no-store failures and fixed
   errors while preserving the `places: []` failure contract. Tests must prove no
   provider call on rejected inputs, unread safe errors and successful valid retry.
   Do not change actual keys, provider fields or call the live API.
2. **F2 — GBFS transport boundary.** The host/path allowlist is checked only before
   ordinary fetch (redirects not explicitly rejected). The abort timer is cleared
   before `.text()`, and the 5 MiB test counts characters after full allocation.
   Replace with actual-byte bounded reading and one fetch/body deadline; reject
   unvalidated redirect destinations. Verify overflow, stalls, cleanup and valid
   feed passthrough without relying on real endpoints. This is a concrete control
   gap, not evidence that an attack or credential leak occurred.
3. **F3 — Generic failures, including metadata.** Replace raw client-visible error
   paths in CelesTrak, terrain, adsbdb, AIS, shootings, safety and temperature;
   inspect FIRMS source summaries and CCTV health metadata as well as HTTP errors.
   ADS-B military non-OK payloads also need sanitization. Preserve success/fallback
   contracts and test synthetic secret/path sentinels never appear on failure.
   Console logging is a separate review surface, not proof of a browser leak.
4. **F4 — Remaining response/lifecycle bounds.** Confirm the exact helpers for
   OpenSky primary/OAuth, FIRMS archives, terrain, CCTV, Overpass and track/route
   paths once; do not duplicate existing caps. Concrete uncapped readers above
   (TomTom, CelesTrak, adsbdb, ADS-B military, temperature forecast) need appropriate
   provider-specific budgets. Keep continuous media distinct from finite JSON.
   Record each helper as verified, fixed or unresolved, rather than declaring all
   networking safe from one timeout constant. Track overflow must not masquerade
   as a successful cached result.
5. **F5 — Method/access matrix for the retained non-voice mounts.** The shared
   local-browser guard is attached only to the three OpenAI/diagnostic routes and
   OpenRouter, not every API mount. A same-origin fetch URL in client code is not
   a server access check. Validate actual client methods (including deliberate
   POSTs) before adding gates; reject non-required methods before paid/cache work.
   Do not silently impose a blanket policy that breaks media or removes features.
   Public/LAN auth and global connection/concurrency limits stay in S3 and require
   an intended target. Existing local development is not deployment approval.

These are five **groups of findings**, not five finished fixes or a completeness
claim. No new feature work or provider expansion is needed. Reuse the prior
voice/sports evidence and run only affected regression groups for each fix.

## Credential boundary (names only, no values inspected)

- OpenAI and OpenRouter keys: server-side authorization; ephemeral Realtime
  credential delivery and configured-status booleans are intentional client data.
- TheSportsDB key: fixed upstream URL path; generic error handling is important
  because logging/forwarding that URL would expose the key.
- Google key: server Places headers and CCTV Street View requests, **also**
  intentionally injected into the map client bundle. Client restrictions must
  fit the chosen API usage; do not claim this key is secret merely because one
  consumer is server-side. Key splitting/restrictions require an operator decision.
- Cesium ion token: intentionally client-injected; account scope/restrictions
  cannot be verified by reading public source.
- OpenSky OAuth/basic credentials, AISStream key, TomTom key, FIRMS map key,
  optional TfL app key and Launch Library `LL2_API_TOKEN`: server consumers.
  Some provider URLs carry credentials. Source placement is not proof all error,
  redirect, log and cache paths are safe; those paths remain in F1–F5/S3.

No actual account scopes, budgets, permissions or credential validity were tested.
The release-use question (personal, private sharing or public/commercial) remains
unanswered; do not infer a choice. Provider/asset/reference rights remain open.

## Verification

Static registration extraction yields the 30 unique literal Vite mounts; the
sports dispatch path supplies the 31st. Compared that set to the table (no missing,
duplicate or extra rows). Reviewed plugin installation, wrappers, representative
handlers/helper call sites and source credential references; checked Markdown
links and `git diff --check`. No runtime changes, test/build rerun, browser action,
user-data/log/env access, provider request, microphone, remote push or deployment.
Hosted CI still applies to `eb1a716`. S2 is inventoried, **not accepted as secure**.
