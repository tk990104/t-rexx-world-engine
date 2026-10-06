# AstroEye finish-line tracker

Updated October 5, 2026, checkpoint 124. Runtime candidate: `7368c55`.

Latest completed outcome: [provider-to-form review](architecture/astroeye-provider-workspace-validation.md)
and [Director handoff/Stop/Escape/completion](architecture/astroeye-director-workspace-validation.md)
passed together on normal browser asset transport, first run, exit 0 and graceful
cleanup. Synthetic responses and simulated camera/style; user data untouched.

| U1 workflow slice | Current evidence | What this does not certify |
| --- | --- | --- |
| Manual charts, comparison, both notes, delete/undo and full backup recovery | Checkpoint 123 passes, including fresh-profile restoration and reload | Native file-save behavior, full app or globe |
| Share restoration/privacy | Checkpoint 123 passes with a separate recipient context | Embedded-host behavior |
| Provider-to-reviewed-form and manual fallback | Checkpoint 124 passes | Live-provider availability or rights |
| Director handoff/cancel/completion and private-data exclusion | Checkpoint 124 passes with real engine/adapter | Real camera, terrain, full style or embedded-host behavior |
| Full app / actual-host map and annotation behavior | **Next active integration check** | Not accepted by the fixture passes above |

Tally remains five accepted, ten open. U1/R2 are not closed by this matrix; it
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

**Five release checks accepted; ten open.** This is an acceptance tally, not a
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
| L1: reproducible release candidate | Clean install, CI, build and applicable tests on one candidate | Run at release consolidation, carrying forward relevant evidence instead of repeating full suites on every documentation change. |
| L2: security and rights | Current route/input/secret/provider/data/asset/recording review | Resolve actual deployment-specific rights and configuration; no license purchase or redistribution is implied. |
| L3: deployment and handoff | Approved target smoke test, backup/restore, rollback and release notes | Target and publication require explicit approval. No deployment or tag is preauthorized. |

Accepted checks: A3 supported-range/reference candidate; V1 bounded commands;
V2 voice transport integration; R1 annotation record contract; R3 annotation
recovery/privacy. These are scoped decisions, not whole-release certification.

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

1. Next, verify missing actual-host/map integration for U1/R2. The composed manual,
   recovery, share, provider and Director fixture checks passed in checkpoints
   123–124; do not rerun them by default. Include R2 where the same workflow can
   supply valid evidence for both.
2. Resolve outstanding U2/U3 checks in bounded runs. Ask for specific manual host
   actions only when tools cannot supply the required evidence.
3. Return to the precise A1/A2 evidence/rights decisions and authorized V3 check.
   They remain release requirements, not reasons to repeat unrelated edge tests.
4. Consolidate L1/L2, then seek target/publication approval for L3.

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
