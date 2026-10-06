# AstroEye finish-line tracker

Updated October 6, 2026, checkpoint 135. Latest security hardening is local; last hosted CI candidate: `eb1a716`.

Latest completed outcome: [incoming voice body limits](architecture/astroeye-voice-request-limits.md).
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
| Manual charts, comparison, both notes, delete/undo and full backup recovery | Checkpoint 123 passes, including fresh-profile restoration and reload | Native file-save behavior, full app or globe |
| Share restoration/privacy | Checkpoint 123 passes with a separate recipient context | Embedded-host behavior |
| Provider-to-reviewed-form and manual fallback | Checkpoint 124 passes | Live-provider availability or rights |
| Director handoff/cancel/completion and private-data exclusion | Checkpoint 124 passes with real engine/adapter | Real camera, terrain, full style or embedded-host behavior |
| Composed note editor, storage and real 3D marker layer | Checkpoint 125 passes, including delete/Undo and pixel/picking assertions | Reference mesh only, no terrain/full app/embedded host |
| Full app / actual-host map and annotation behavior | **Next: bounded manual host check or restored browser tooling** | Not accepted by the fixture passes above |

Tally is now six accepted, nine open. U1/R2 are not closed by this matrix; it
separates completed composed checks from the specific integration evidence still
missing. Reuse these results unless relevant code changes.

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

**Six release checks accepted; nine open.** This is an acceptance tally, not a
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
| R2: event-note workflow | Accept save/reopen/edit/delete and opt-in map behavior together | Implemented and partially tested; finish actual-host/map workflow and bounded/accessibility review. |
| U1: complete user workflow | Manual/provider entry through charts, comparison, notes, backup/recovery, sharing and Director handoff | **Next active work package.** Consolidate existing scenario evidence and verify the missing composed paths using synthetic data. |
| U2: usability/accessibility | Keyboard, focus, status, reduced motion and narrow/wide behavior | Reuse valid evidence; distinguish DOM checks from actual screen-reader and host behavior. Record manual-only checks explicitly. |
| U3: performance | Reviewed collection limits and timing budgets with shared-state safety | Baselines exist; finish actual-host/representative measurements and explicitly accept supported limits. Do not claim that 1,000-event test runs establish a device guarantee. |
| L2: security and rights | Current route/input/secret/provider/data/asset/recording review | Provider/backup limits, OpenAI error/cache boundaries, metadata/error privacy, token/HUD response bounds and HUD/diagnostic inbound reads addressed (129–135). Access/origin policy, global connection limits, remaining routes and deployment-specific rights remain open. |
| L3: deployment and handoff | Approved target smoke test, backup/restore, rollback and release notes | Target and publication require explicit approval. No deployment or tag is preauthorized. |

Accepted checks: A3 supported-range/reference candidate; V1 bounded commands;
V2 voice transport integration; R1 annotation record contract; R3 annotation
recovery/privacy; L1 reproducible candidate (eb1a716, checkpoint 128). These are
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

1. Next, verify missing actual-host/map integration for U1/R2 using the short host
   check in the checkpoint 125 evidence. Browser tooling is currently blocked
   before tab access; do not replace host evidence with repeated fixture runs.
   The composed manual,
   recovery, share, provider and Director fixture checks passed in checkpoints
   123–125; do not rerun them by default. Include R2 where the same workflow can
   supply valid evidence for both.
2. Resolve outstanding U2/U3 checks in bounded runs. Ask for specific manual host
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
