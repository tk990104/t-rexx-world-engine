# AstroEye finish-line tracker

Updated October 6, 2026, checkpoint 144. Latest changes are local; last hosted CI candidate: `eb1a716`.

Latest completed outcome: [U2 usability/accessibility accepted](architecture/astroeye-usability-acceptance.md).
Wide/narrow keyboard, visible focus, browser accessibility labels/live status,
actual reduced-motion navigation and native draft download/leave-warning checks
pass on standalone Chromium. Fixed Space interception and native date-segment
focus styling. All 172 focused tests, production build and five final full-app
phases pass; final browsers close gracefully. **Nine accepted, six open.**
Next: U3 performance/regression. Embedded preview and OS screen-reader speech
remain unverified. Existing key/data unchanged; no live calls, push or deployment.

Checkpoint 143 outcome: [U1 complete workflow accepted](architecture/astroeye-full-workflow-acceptance.md).
Four production-app Chromium phases pass manual/provider entry, frozen comparison
and notes, real downloads, delete/Undo, reviewed import, fresh-profile share/restore,
and actual Director/Cesium Stop/Escape/completion. Reuses same-build R2 map evidence.
All final runs exit 0 and close gracefully; runtime/build unchanged from `06f1ccd`.
**Eight accepted, seven open.** Next: remaining U2 usability/accessibility checks.
No user data/key changes, live provider/microphone use, push or deployment.

Checkpoint 142 outcome: [R2 event-note workflow accepted](architecture/astroeye-note-workflow-acceptance.md).
The user selected personal-local use and standalone Chromium as the first-release
browser target; embedded preview remains explicitly unverified. Full production-app
save/edit/delete/Undo, fresh-process persistence, keyboard opt-in and real OSM/Re:Earth
map rendering pass. Fixed overlapping event/note labels and hidden OSM attribution.
49 focused tests and production build pass; all four final browser phases exit 0
and clean up gracefully. **Seven accepted, eight open.** Next: missing U1 full-app
workflow evidence, reusing these note results. No user data/key changes, push or deployment.

Checkpoint 141 outcome: [GBFS bike-share safeguards](architecture/astroeye-gbfs-security.md).
F2 implemented: 5 MiB streamed byte cap, 12-second fetch/body deadline, redirect
rejection, cancellation and fixed no-store errors; valid feed/cache contracts retained.
All 52 focused tests pass (10.603s); production build passes (263 modules, 8.20s), with existing browser-externalization and large-chunk warnings.
Six accepted, nine open. Next: F3 remaining raw failures; F4/F5 and rights remain open.
No live provider calls, user data/key changes, push or deployment.

Checkpoint 140 outcome: [Google Places safeguards](architecture/astroeye-google-places-security.md).
F1 implemented: local access/input validation, response caps/deadline, redirect
rejection and fixed no-store failures for both routes; valid result contracts retained.
All 63 focused tests pass (12.836s); production build passes (263 modules, 13.95s), with existing browser-externalization and large-chunk warnings.
Six accepted, nine open. Next: F2 GBFS transport; F3–F5 and rights remain open.
No actual key/data changes, live provider/microphone tests, push or deployment.

Checkpoint 139 outcome: [31-mount route/key inventory](architecture/astroeye-route-inventory.md).
S2's inventory pass is complete, not its remediation or security acceptance.
Five finding groups have concrete stopping conditions; Google Places is the next
coding slice, followed by GBFS. Existing reviewed safeguards are not rerun by default.
Six accepted, nine open. Documentation/coverage/link checks only; no runtime,
key/data changes, test/build rerun, live calls/microphone, push or deployment.

Checkpoint 138 outcome: [OpenRouter fallback safeguards](architecture/astroeye-openrouter-security.md).
Local access checks, upload/response caps, shared fallback deadline and safe errors
complete the S1 implementation slice. All 67 focused tests pass (29.659s).
Production build passes (263 modules, 17.81s). Six accepted, nine open; S1 is not all of L2.
Next: S2's one-pass remaining route/key inventory, then exact findings only.
No real credentials/data changed, live API/microphone tests, push or deployment.

Checkpoint 137 outcome: [bounded security/rights closeout ledger](architecture/astroeye-security-rights-closeout.md).
Existing evidence is separated from seven concrete L2 closeout outcomes and
approval-dependent decisions. Current sports/map policy spot-checks recorded;
unreviewed sources remain unknown. Stale security guidance corrected.
Six accepted, nine open. Next coding slice: bounded, sanitized OpenRouter fallback.
Documentation only; no tests/build rerun, runtime/data/key changes, push or deployment.

Checkpoint 136 outcome: [local voice request access](architecture/astroeye-voice-request-access.md).
All three voice routes now require a loopback peer/Host/port and same-origin
browser evidence before keys, reads, provider calls or logging. Remote/custom-host
voice access intentionally fails closed; this is not public authentication.
All 52 focused tests pass (51.161s); production build passes (263 modules, 58.63s).
Six accepted, nine open. Next: bounded remaining L2 route/rights closeout list.
No real key/data changes, live calls/microphone, push, deployment or new hosted CI.

Checkpoint 135 outcome: [incoming voice body limits](architecture/astroeye-voice-request-limits.md).
HUD/diagnostic uploads now have one 10-second read deadline, fixed capped buffers,
abort/close handling and listener cleanup. Failed reads close the incomplete request
before provider calls or diagnostic writes. All 44 focused tests and production
build pass (263 modules, 36.47s). Six accepted, nine open; next access/origin review.
No real key/data changes, live API/microphone, push, deployment or new hosted CI.

Checkpoint 134 outcome: [voice provider response limits](architecture/astroeye-voice-response-limits.md).
Token/HUD requests now reject redirects and enforce a 256 KiB body cap plus one
15-second fetch/body deadline. Cancellation, safe failure and retry are covered by
all 43 passing focused tests. Production build passes (263 modules, 1m 53s). Six accepted, nine open;
next access/origin and inbound-request review, with rights decisions still open.
No live provider/microphone, key/data changes, push, deployment or new hosted CI.

Checkpoint 133 outcome: [browser voice error privacy](architecture/astroeye-voice-error-privacy.md).
Error history is now 30 immutable, allowlisted records in memory; no legacy-history
reads/writes, raw message/extra retention or shared report objects. Existing data
is preserved. All 159 focused tests and production build pass (263 modules, 25.15s).
Six accepted, nine open; L2 still needs voice response/access controls and rights.
No live provider/microphone, user-data access, push, deployment or new hosted CI.

Checkpoint 132 outcome: [diagnostic-file privacy](architecture/astroeye-voice-diagnostic-privacy.md).
Client transmission and server logging are off by default. Explicit opt-in stores
only known event/status metadata, with server validation, a 4 KiB request limit
and a 256 KiB file cap. No automatic expiry or legacy-log deletion. All 172 focused
tests and production build pass (262 modules, 37.42s). Six accepted, nine open;
L2 remains open for browser error-history, access/resource controls and rights.
Existing key/data/logs untouched; no live calls, microphone, push or deployment.

Checkpoint 131 outcome: [OpenAI proxy error/cache boundaries](architecture/astroeye-openai-proxy-security.md).
Voice-token and HUD routes no longer return raw upstream/exception errors and now
send no-store on all branches. Temporary-token delivery remains intact. All 83
offline focused tests and production build pass. Existing-key reuse was approved;
no real-key changes, live calls, microphone, push or deployment. Six accepted,
nine open; next diagnostic-recording review. L2 and actual-host checks remain open.

Checkpoint 130 outcome: [backup text-size boundary](architecture/astroeye-import-size-security.md).
The shared record API now enforces the UI's 10 MiB limit before parsing JSON text,
including Unicode byte sizes. Rejected imports preserve records and clear stale
approval. All 31 focused tests and production build pass. Six accepted, nine open;
L2 remains incomplete. Local only, no push/deployment or new hosted CI.

Checkpoint 129 outcome: [bounded sports-provider response fix](architecture/astroeye-provider-response-security.md).
The server now caps schedule/venue streams at 2 MiB before parsing, cancels oversized
responses and preserves safe retry/manual fallback. All 59 focused tests and the
production build pass. L2 is still open for the remaining review and rights work;
no new gate closed. Six accepted, nine open. This local change is not covered by
the earlier eb1a716 hosted CI result and has not been pushed.

Checkpoint 128 outcome: [reproducible candidate acceptance](architecture/astroeye-ci-acceptance.md).
Hosted Windows and Linux CI both pass for eb1a716. Local complete test/build and
composed browser evidence are tied to this candidate by unchanged-code checks.
**L1 is accepted: six accepted, nine open.** Actual-host workflow, accuracy, voice,
accessibility/performance, security/rights and deployment criteria are not waived.
No deployment or tag; the authorized 77-commit push completed.

Checkpoint 127 outcome: [clean Windows candidate verification](architecture/astroeye-clean-candidate.md)
passes locked installation, all 3,413 unit/allocation tests, seven CI/runner checks
and production build from an isolated archive of `89468fc`. The initial overlay
run hit the helper's too-short limit; only that step/build were resumed with a
five-minute cap and unchanged allocation budgets. No source/data changes or remote
CI execution. The local clean-install portion of L1 is complete; hosted CI and
actual-host acceptance still remain. Five accepted, ten open.

Checkpoint 126 outcome: [release CI foundation](architecture/astroeye-release-ci.md)
adds pinned-Node Windows/Linux clean-install, complete unit/allocation and build
jobs, with read-only permissions and execution limits. All seven local YAML/runner
contract tests pass. No GitHub run, clean install, push or deployment occurred;
L1 remains open. Browser initialization is still blocked and the user has not yet
performed the manual marker check. Do not repeat already-passing fixture work.

Checkpoint 125 outcome: [composed event-note editor and real marker renderer](architecture/astroeye-map-workspace-validation.md)
passes save/edit/confirmed delete/Undo, opt-in privacy, unchanged chart/camera and
owned-entity cleanup. Existing three-marker render regression also passes; both
final runs exit 0 with graceful cleanup. QA-only, isolated synthetic records and
WGS84 reference mesh: no terrain/full-app/embedded-host certification. Embedded
tooling failed before tab access; the linked short manual host check is next.

Checkpoint 124 outcome: [provider-to-form review](architecture/astroeye-provider-workspace-validation.md)
and [Director handoff/Stop/Escape/completion](architecture/astroeye-director-workspace-validation.md)
passed together on normal browser asset transport, first run, exit 0 and graceful
cleanup. Synthetic responses and simulated camera/style; user data untouched.

| U1 workflow slice | Current evidence | What this does not certify |
| --- | --- | --- |
| Manual charts, comparison, both notes, delete/undo and full backup recovery | Checkpoint 143 passes in production app, including actual downloads and recipient reload | Native OS file-picker/dialog behavior and embedded host |
| Share restoration/privacy | Checkpoint 143 passes in a fresh native profile | Embedded-host behavior |
| Provider-to-reviewed-form and manual fallback | Checkpoint 143 passes in production app with synthetic responses | Live-provider availability or rights |
| Director handoff/cancel/completion and private-data exclusion | Checkpoint 143 passes with real engine, camera and styles | Remote map states during playback and embedded host |
| Composed note editor, storage and real 3D marker layer | Checkpoint 125 passes, including delete/Undo and pixel/picking assertions | Reference mesh only, no terrain/full app/embedded host |
| Full production-app map and annotation behavior | **Checkpoint 142 passes; R2 accepted on approved standalone Chromium** | Embedded preview and U3 remain unverified; Director has separate checkpoint 143 evidence; U2 is reviewed in checkpoint 144 |

Matrix updated at checkpoint 144: nine accepted, six open. R2, U1 and U2 are
accepted by their linked full-app reviews for standalone Chromium. Embedded
preview, OS screen-reader speech and U3 remain unverified. Reuse results unless
relevant code changes.

Checkpoint 123 outcome: [composed everyday workflow and fresh-profile recovery](architecture/astroeye-everyday-workflow.md)
passed, together with a current share-link regression, using normal browser asset
transport. Manual charts, frozen comparison/note capture, private-note exclusions,
delete/undo, reviewed import and full backup restoration after reload are verified
in isolated synthetic profiles. No runtime changes. U1/R2 are not yet accepted:
actual-host/map criteria remain. Provider/Director fixture handoffs have since
passed in checkpoint 124 above. No unchanged everyday-workflow rerun is needed.

## User direction and scope

Continue AstroEye before starting another module. Give a short **completed / still
open / next** update at every checkpoint. The user has limited credits and wants a
visible path to completion, not an expanding feature list. Keep the existing v0.1
scope and 1900–2100 UTC date range; additional features remain deferred.

The first release targets personal use on the user's computer in standalone Chromium.
The embedded preview is explicitly unverified; no public/LAN deployment is approved.
Work through a complete acceptance outcome when safely possible instead of asking
the user to continue after each small slice; pause for genuine missing authority.

**Nine release checks accepted; six open.** This is an acceptance tally, not a
percentage of implementation complete. Many open checks concern verification of
already implemented functionality. The detailed [release checklist](ASTROEYE-RELEASE-CHECKLIST.md)
remains authoritative; earlier evidence is tied to its reviewed candidate and
must be rechecked when affected by changes.

## Remaining work

| Check | Remaining outcome | Status / next action |
| --- | --- | --- |
| A1: chart angles and houses | Accepted independent reference coverage, including polar/boundary cases | Numerical candidate exists, but its reference redistribution disposition and remaining coverage are not accepted. Do not publish that local pack. |
| A2: planetary hours | Final independent accuracy decision | Consolidated below. Short-hour precision and daily classification remain unresolved; more passing internal tests do not close them. |
| V3: live voice | Authorized live smoke test and complete failure/interaction review | Offline implementation evidence exists. Obtain specific consent before microphone/provider transmissions or metered usage. Manual operation must remain usable. |
| U3: performance | Reviewed collection limits and timing budgets with shared-state safety | Baselines exist; finish actual-host/representative measurements and explicitly accept supported limits. Do not claim that 1,000-event test runs establish a device guarantee. |
| L2: security and rights | Current route/input/secret/provider/data/asset/recording review | Provider/backup limits, OpenAI error/cache boundaries, metadata/error privacy, token/HUD response bounds, HUD/diagnostic inbound reads and local voice origin access addressed (129–136). Global connection limits, remaining routes, public authentication and deployment-specific rights remain open. |
| L3: deployment and handoff | Approved target smoke test, backup/restore, rollback and release notes | Personal-local/standalone Chromium target selected; handoff checks remain. No deployment, publication or tag is preauthorized. |

Accepted checks: A3 supported-range/reference candidate; V1 bounded commands;
V2 voice transport integration; R1 annotation record contract; R3 annotation
recovery/privacy; L1 reproducible candidate (eb1a716, checkpoint 128); R2 event-note
workflow (personal-local standalone Chromium, checkpoint 142); U1 complete workflow
(same target, checkpoint 143); U2 usability/accessibility (same target, checkpoint 144,
browser accessibility interface tested; OS screen-reader speech unverified). These are
scoped decisions, not whole-release certification.

## Consolidated A2 decision

**Not accepted.** This review completes the evidence inventory, not the accuracy
gate. Original source timestamps, comparison thresholds and application values
remain unchanged.

| Evidence | Source days | Decisive source-derived hour midpoints | Precision-limited assignments |
| --- | ---: | ---: | ---: |
| Original city/solstice pack | 8 | 72 | 0 |
| Northern daylight transitions | 4 | 12 | 12 |
| Northern July recovery | 2 | 24 | 0 |
| Northern polar night | 6 | 36 | 12 |
| Southern transitions, ordinary cycles | 12 | 72 | 0 |
| Southern midnight window, additional cycle | 0 additional (reuses southern pack) | 24 | 0 |
| Total | 32 distinct pack days | 240 | 24 |

The five-event [southern midnight comparison](architecture/astroeye-midnight-window-review.md)
passes with all events preserved; maximum discrepancy is 23.154 seconds against
the unchanged 120-second screen. The strict daily report still fails for the two
retained January 24/25 cases. Agreement across the window is **not** agreement on
which calendar day contains each event or on its daily category.

The 24 short-hour assignments remain unresolved by the retained minute-rounded
references. The [short-hour presentation safeguard](architecture/astroeye-planetary-hour-boundaries.md)
labels calculated intervals of four minutes or less provisional. That cutoff is
a display policy, not a global error bound or permission to close A2. Internal
millisecond-edge consistency and traditional ruler-sequence tests are distinct
from independent timing evidence and do not establish predictive validity.

To close A2, obtain sufficient independent precision and an accepted treatment of
the daily cases, **or request an explicit first-release support-scope decision**
and implement/document/review the resulting restrictions. No scope reduction is
approved by this tracker. Further source collection should target those exact
gaps, not enlarge the date/location matrix without a stated acceptance purpose.

## Execution and reporting

1. R2, U1 and U2 are accepted for the user-approved standalone Chromium target.
   Reuse checkpoints 142–144 full-app/native-storage/map/download/Director/accessibility evidence;
   rerun affected paths when code changes, not unchanged scenarios by default.
   Embedded browser tooling remains blocked and that preview remains unverified.
2. Resolve outstanding U3 performance checks in bounded runs. Ask for specific manual host
   actions only when tools cannot supply the required evidence.
3. Return to the precise A1/A2 evidence/rights decisions and authorized V3 check.
   They remain release requirements, not reasons to repeat unrelated edge tests.
4. Finish L2 and seek target/publication approval for L3. L1 is accepted for
   eb1a716 after successful hosted Windows/Linux CI and evidence consolidation.
   Reuse these results unless affected; no further push/deployment is implied.

Do not add feature scope or silently waive gates. Reuse unchanged evidence;
rerun checks affected by an implementation change. No browser/build rerun is
needed for documentation alone. Keep browser jobs isolated and capped at 60
seconds, close only owned resources, and preserve the user's records and preview.

Every handoff should state what actually completed, whether a gate closed, the
remaining tally, and the next bounded outcome. A checkpoint is not automatically
a completed gate. Do not give a days/credits estimate unsupported by the work.

Checkpoint 122 is a documentation/evidence-review checkpoint. Runtime, records,
reference fixtures and release scope are unchanged; nothing has been published.
Verification against runtime `7368c55`: 49 focused solar-reference, transition,
internal-recovery and presentation tests passed in 13.659s; the separate northern
recovery-reference file passed all five tests in 6.104s. No failures, skips or
cancellations in either run. Thus all five source packs and the midnight window
were exercised in this review, while the deliberately retained daily discrepancies
and short-hour limitations remain visible. These 54 passing tests are not A2
acceptance. No full suite, build, browser or live-source retrieval was repeated.
