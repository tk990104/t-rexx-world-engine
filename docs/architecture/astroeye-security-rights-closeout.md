# AstroEye security and rights closeout

October 6, 2026, checkpoint 137. Read-only source review of `94eecc9` plus
documentation corrections; no runtime or release-scope change. **L2 remains open.**
The release still has six accepted gates and nine open. The seven rows below
divide one existing gate; they are not seven new features or a time estimate.

Checkpoint 138 update: [S1 implemented and tested](astroeye-openrouter-security.md).
OpenRouter now has local access checks, bounded upload/response readers, a shared
fallback deadline and generic errors. All 67 focused tests pass; final build
result is in the finish-line tracker. The S1 row below preserves the initial
finding, not the current code. S2 is next; S2/S3 and R1–R4 remain open.

Checkpoint 139 update: [S2 route inventory](astroeye-route-inventory.md) covers
31 application API mounts and the source credential boundary. Inventory is
complete, remediation is not: five finding groups remain. Google Places is next,
then GBFS. S2/S3 and rights outcomes stay open; no runtime or deployment change.

## What is already verified

Checkpoint 142 scope update: the user selected **personal use on their computer**
and explicitly approved standalone Chromium for first-release browser acceptance,
with embedded preview unverified. [R2 note workflow](astroeye-note-workflow-acceptance.md)
is now accepted (seven accepted, eight open overall); L2 is not. The actual-map
test found and fixed popover-only OSM attribution by making it linked/on-screen.
This does not clear all provider/export/recording paths. F1/F2 have since passed
scoped fixes; the remaining F3–F5/S3 and rights work stays open.

Reuse the scoped evidence in checkpoints 129–136: sports upstream size bounds,
backup text limits, OpenAI error/cache boundaries, metadata-only default-off
diagnostics, memory-only safe error history, upstream response deadlines/caps,
inbound upload limits and local voice-origin checks. The latest affected suite
passed 52 tests and production build at checkpoint 136. This review did not rerun
them. No evidence here supersedes the separate A1/A2, V3 or actual-host gates.

## Finite closeout ledger

| ID | Concrete remaining outcome | Evidence and completion condition | Authority |
| --- | --- | --- | --- |
| S1 | Bound and sanitize the OpenRouter fallback | `vite.config.js` `openRouterProxy()` still uses the older body reader, unbounded `response.json()`, fetch without an explicit deadline/redirect rejection, and raw error forwarding. Add offline-tested request/response/whole-operation bounds, safe errors and local-origin protection; cover both plugin hooks and fallback attempts. No model-list expansion. | Local implementation; no real API call needed. **Next coding slice.** |
| S2 | Record the exposed route and key boundary | Inventory each installed middleware in `vite.config.js` and `server/sportsScheduleProxy.js`; mark local access, input/response bounds, upstream host policy, raw errors and key exposure. Include Google, sports and inherited routes, not just OpenAI. Resolve concrete defects for retained routes; do not label unaudited routes safe or silently remove them. | Read-only review and scoped fixes; exposure changes need explicit approval. |
| S3 | Set and verify a resource/exposure policy | Per-route deadlines are not server-wide header, request, connection or concurrency limits. No explicit server-wide overrides were found in the inspected config/server sources; Node/Vite defaults are not zero and need measurement before changing them. Verify bounded stalled-connection/concurrent-request behavior with synthetic inputs and no provider spending. | Local tests permitted; LAN/public authentication, proxy trust, budgets and hosting require a chosen target and approval. |
| R1 | Produce a shipped-code/data/asset rights manifest | Map the lockfile production graph and actual `dist`/public assets to retained license notices and source obligations. Start with `LICENSE`, `NOTICE.md`, `DATA_SOURCES.md`, `public/models/README.md`, `docs/media/README.md`; these are inventory evidence, not fresh clearance. Include cable data, ODbL extracts and the separate GPL flight-sim model/source. | Verify sources; ask before removing/replacing licensed assets or buying rights. A hidden UI toggle does not remove a shipped file. |
| R2 | Resolve map display, AI capture and recording policies | Compare enabled map providers and every export/screenshot/AI-image path against provider terms; keep credits visible in relevant modes. Google policy covers machine interpretation as well as video. Audit actual paths before deciding a safeguard; no general recording permission follows from showing credits. | Local audit/fixes within existing scope; paid rights, publication or feature removal need approval. |
| R3 | Resolve independent-reference redistribution | A1's separate Swiss-derived candidate remains outside Git per retained evidence; do not stage or package it before a documented disposition. Inventory published chart, Horizons and solar reference packs with original sources/terms and intended distribution. Numerical agreement is not redistribution permission. | Source research permitted; no reference copying/publication or scope reduction is authorized by this checklist. |
| R4 | Complete the retained live-provider disposition | Use every retained row of `DATA_SOURCES.md`, plus TheSportsDB and AI providers, as the finite inventory. Record source URL/date, applicable use, attribution, caching/export constraints, account permission still needed and allow/block/unknown decision. Unknown stays unresolved, not implicitly accepted. | No account terms accepted, subscription purchased or provider contacted without authorization. |

S2 is an inventory pass, not an instruction to rewrite every inherited module.
If it identifies a material defect, record affected routes and a bounded fix;
otherwise retain existing evidence. L2 closes only after each retained path has
a reviewed disposition for the selected release profile and relevant fixes pass.

## Current source spot-checks (not a complete legal clearance)

| Source reviewed October 6 | What the source supports | Project disposition / unresolved work |
| --- | --- | --- |
| [TheSportsDB terms](https://www.thesportsdb.com/docs_terms_of_use.php), page dated September 17, 2026 | Development use of the API; app-store publication requires paid subscription. Paid use still requires attribution and does not clear third-party artwork. | Current normalizer imports event/venue fields, not artwork. Preserve attribution; verify actual release use and account entitlement without reading secrets. No subscription purchase. |
| [Google Map Tiles policies](https://developers.google.com/maps/documentation/tile/policies) | Attribution and constrained storage; non-visualization uses include prohibited machine interpretation. Promotional videos have specific conditions, including a 30-second maximum, no Street View and promotional labeling. | Do not treat general screenshot, voice-vision or Director export as automatically allowed. Review actual code and applicable agreement, including billing-region differences. No permission conclusion for the user's account. |
| [OSMF raster tile policy](https://operations.osmfoundation.org/policies/tiles/) | Visible attribution, valid browser Referer, HTTP-cache compliance and no bulk/prefetch downloads. Tile service availability is not guaranteed. | Review actual request/cache/referrer behavior; do not use tile-sweeping browser QA. OSM data licensing and hosted tile-service rules are separate. |
| [Astronomy Engine license](https://github.com/cosinekitty/astronomy/blob/master/LICENSE) and local notices | Upstream offers MIT code; the project records Astronomy Engine, not Swiss Ephemeris, as its calculation dependency. | Keep the exact installed-version notice in the production manifest. This does not resolve reference-pack rights. |
| TeleGeography | Local `LICENSE` records CC BY-NC-SA 3.0. The attempted current FAQ lookup failed, and the home page returned no readable policy text. | Current permission was **not verified**. Keep commercial-use disposition open; obtain an authoritative source or written permission before clearing it. |

The rest of `DATA_SOURCES.md`, models, media and transitive dependencies have not
received fresh provider-by-provider clearance in this checkpoint. Do not present
inherited statements such as "public broadcast" or "free" as reuse permission.
This is an engineering evidence ledger, not a legal opinion about the user's use.

## Decisions, and what can proceed now

- User decision received October 6: personal-local first, standalone Chromium
  acceptance target, embedded preview explicitly unverified. This does not authorize
  publication or LAN exposure. Feature scope and 1900–2100 support stay unchanged.
- Public/LAN deployment, authentication design for a chosen host, purchases, rights
  requests and publishing remain separately authorized actions. A usage preference
  alone does not authorize any of them.
- Continue with S1 using mocks while that preference is pending. Then perform the
  S2 inventory once and resolve the exact findings. R1–R4 use the selected profile;
  no broad speculative hardening or repeated unchanged test suites.
- R2/U1 actual-preview note save/edit/delete/undo/map acceptance remains unverified
  by the user. It is separate from the L2/R2 row above (which means map rights).

## Verification of this checkpoint

Inspected clean Git state, actual route registration/handlers, existing gate
definitions and notices; refreshed the linked policy sources. Corrected stale
`SECURITY.md` descriptions of diagnostics, broad proxy guarantees and LAN voice
access. Checked documentation diff and local links. No build/test rerun: all
changes are Markdown. No key/env read, saved-record/log access, provider API call,
microphone, browser action, remote push or deployment. Hosted CI remains scoped
to `eb1a716`; newer runtime commits need candidate verification before promotion.
