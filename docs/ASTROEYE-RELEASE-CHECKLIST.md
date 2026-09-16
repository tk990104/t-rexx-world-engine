# AstroEye v0.1 release checklist

Scope baseline: 2026-09-12, implementation checkpoint 34 (`92edee7`).

**Status: pre-release; A3, V1, V2, R1 and R3 accepted for their reviewed candidates; 10 acceptance gates remain open across five work packages.**
These are grouped outcomes, not an estimate of commits or development days. Existing
features and earlier passing tests are useful evidence, but do not close a release
gate until the complete criterion has been verified on the release candidate.
The `0.1.0` package/manifest version and `mvp` manifest label are not release certification.

Checkpoint 72 adds an unmounted event-note editor with isolated save/reopen/edit/delete,
draft preservation and lifecycle checks; see the [annotation candidate](architecture/astroeye-research-annotation-contract.md).
This is not R2/R3 acceptance: recovery/privacy, actual workspace/Director integration,
opt-in map behavior and embedded-host verification still need review.

Checkpoint 73 adds annotation-specific backup/import/exclusion tests and session
deletion undo (49 focused tests plus isolated browser QA passing). Collection-level
import replacement is explicit, not per-note merge. That checkpoint's candidate was unmounted.

Checkpoint 74 mounts the editor under **AstroEye → Event notes**. All 454 platform
tests, the production build and isolated workspace tests pass, including real reload
persistence and Director-signal suspension. Full embedded-host/cinematic playback
verification, opt-in note-marker behavior and reviewed release acceptance remain open.

Checkpoint 75 adds opt-in read-only note markers, off by default and disabled on
playback/shared views without automatic resumption. 460 platform tests, production
build and mocked-viewer browser checks pass; real Cesium entity tests cover bounds,
privacy and ownership. Actual globe appearance/interaction and embedded-host review
are not yet verified; no gate is closed by this checkpoint.

Checkpoint 76 adds real WebGL reference-mesh checks with synthetic in-memory notes:
visible/hidden pixels, picking, camera stability, far-side occlusion and playback
opt-out pass. The marker depth override is now bounded to 200 km. 460 platform
tests and the production build pass; the isolated browser exits 0 with graceful
cleanup and no external requests. Actual terrain readiness was inconsistent; the
test instead uses a synchronous WGS84 mesh, not actual terrain or the embedded
host. Overlap/host acceptance remains open; no release gate is newly accepted.

Checkpoint 77 gives exact-coordinate notes one count/UTC-range label without
merging records or moving captures. 461 platform tests and isolated WebGL checks
pass; the final shared-label screenshot was inspected. Actual embedded access
still fails at tool initialization, and nearby distinct labels may overlap. The
annotation contract supplies a manual preview procedure; it has not been completed.
This is bounded overlap improvement, not terrain/embedded-host or R1/R2/R3 acceptance.

## Finish line

Checkpoint 95: [keyboard focus visibility](architecture/astroeye-responsive-host.md#checkpoint-95--keyboard-focus-clears-sticky-overlays)
fixes a reproduced narrow-header obstruction on reverse Tab. A lifecycle-safe
focus handler clears sticky overlays without moving the globe or activating
controls; narrow/wide host checks and 496 platform tests/build pass. U2 remains
open for broader state, reduced-motion and screen-reader coverage.

Checkpoint 94: [narrow-host layout evidence](architecture/astroeye-responsive-host.md)
verifies temporary rail suppression/restoration, sticky Close header, shortcut
target offsets and bounded compact sky at actual 566px and tested 390/1100px widths.
Keyboard Close returns launcher focus; temporary viewport overrides are reset.
All 491 platform tests/build pass. U2 remains open for broader accessibility and
state coverage; no supported-device matrix or new release gate is accepted.

Checkpoint 93: [event-sky host checks](architecture/astroeye-render-check.md#checkpoint-93--event-sky-preview-and-compact-panel)
complete at event start and after a +15-minute unsaved preview, with one counter
advance between samples and no ephemeris updates within either idle window.
Restoring Event start and leaving sky restore chart time and the prior ring-off
preference. Compact shortcuts now scroll instead of obscuring controls, verified
in host screenshots. All 487 platform tests/build pass. U2/U3 remain open: broader
narrow-host layout, accessibility, active-motion and budget work is not certified.

Checkpoint 92: [actual embedded-host idle observations](architecture/astroeye-render-check.md#checkpoint-92--embedded-host-observation-and-readable-results)
complete twice at 10,006/10,007 ms with zero scene renders, no continuous holds,
event sky off and zero ephemeris delta. The new readable summary is verified in the
embedded UI; 487 platform tests and the production build pass. This closes the
pending idle-observer UI check only, not U3: active/event-sky cases, device/collection
support and timing budgets remain open. No release gate is newly accepted.

Checkpoint 78: [research acceptance review](architecture/astroeye-research-acceptance.md)
accepts R1/R3 for runtime `8bb14d9`, backed by 57 current focused tests, native
IndexedDB competing-connection/backup checks and editor recovery QA. Both browsers
exit 0 with graceful cleanup. No runtime change or new build/full-suite claim.
R2 and embedded terrain/accessibility checks remain open; no publication is approved.

Choose or manually enter a sporting event, verify its time and place, inspect its
reproducible chart on Earth, compare it with another chart, keep local research,
and back up or deliberately share the appropriate information. Optional providers
must not prevent manual use. No prediction accuracy or wagering advice is promised.

Release `v0.1.0-astroeye` only after all 15 gates below have recorded evidence, no
release-blocking defects remain, and the user explicitly approves publication.
Do not silently waive a gate: a scope change requires a documented user decision.

## Already implemented — retain, do not rebuild

- Manual event entry, explicit IANA-zone/DST review, NFL schedule discovery and provenance.
- Planetary positions, supported houses, aspects, planetary hours, chart wheel and time explorer.
- Selected/saved venue markers, search, sorting, pagination, framing and session callouts.
- Shareable event views, event-time sky and the first Director event-tour recipe.
- Session-pinned chart comparison, cross-chart aspect filters and text reports.
- Reviewed JSON imports, full/matching exports, overwrite protection and deletion undo.
- A local notebook, static chart references, draft downloads and unsaved-note leave warnings.

See [calculation validation](architecture/astroeye-validation.md),
[schedule coverage](architecture/astroeye-sports-schedules.md),
[notebook boundaries](architecture/astroeye-research-notebook.md) and
[native browser coverage](architecture/astroeye-browser-safety.md).
Existing standalone Chromium results do not certify the embedded preview host.

## 1. Calculation validation

- [ ] **A1 — Angles and houses:** store independently sourced ASC/MC and Whole Sign/Equal
  house fixtures with provenance, coordinate/time conventions and tolerances justified
  before comparison. Cover both hemispheres, longitude wrap and high-latitude behavior;
  tests must fail outside tolerance. Reusing the production formula is not independent evidence.
- [ ] **A2 — Planetary hours:** independently check sunrise/sunset and before/at/after
  hour/day boundaries, including venue-local date changes and locations without a normal
  sunrise/sunset cycle. Unavailable results must remain explicit rather than guessed.
- [x] **A3 — Supported range:** document and consistently handle the supported date range;
  add station, zodiac-boundary and historical-zone samples appropriate to that range.
  Rerun deterministic internal tests and stored external position comparisons. Describe
  sampled agreement, not universal accuracy or predictive validity.

Current A3 decision: [candidate verification and evidence](architecture/astroeye-a3-candidate-verification.md).
All 418 platform tests, 303 stored positions/101 motion screens, production build
and two isolated browser checks pass against runtime candidate `6c96b86`.
A3 must be revalidated after relevant changes; A1/A2 and the other gates remain
open. The checkpoint history below retains earlier counts and then-open statuses;
this decision supersedes its old A3 next-step statements.

Start with the existing [validation backlog](architecture/astroeye-validation.md).
The user-approved [1900–2100 UTC date-range policy](architecture/astroeye-supported-date-range.md)
now guards new chart calculations, previews and links while retaining stored archival
records. This establishes handling, not universal accuracy. A3 remains open for
independent range, station, zodiac-boundary and historical-zone samples.
[Historical-zone conformance](architecture/astroeye-historical-time-zones.md) now
covers sixteen IANA-derived cases, including second-level offsets, a 23-hour fold,
a fifteen-minute gap and a skipped civil date. These are runtime conformance checks,
not independent proof of historical timekeeping. A3 remains open for planetary
range/station/zodiac reference work and final candidate verification.
[Historical/endpoint position references](architecture/astroeye-ten-body-range-references.md)
now cover all ten bodies at three older/endpoint centers. The late-2100 Moon
discrepancy in models 1–3 is preserved as an explicitly labeled legacy diagnostic.
[Model 4](architecture/astroeye-calculation-model-4.md) now activates corrected
UTC/TT positions with provenance, compatibility checks and visible time-policy notes.
All 240 stored positions and 80 motion checks pass unchanged limits; full charts
pass all 90 range positions. All 392 platform tests pass; prior model-4 browser
integration checks passed at checkpoint 53 and were not rerun for this offline-only
extension. The active-model Moon TODO is resolved. A3 remains open for station/zodiac
samples and the complete candidate rerun. Angles, sky rotation and planetary hours
retain their model-3 time approximations; this does not close A1 or A2.
[First station/zodiac references](architecture/astroeye-station-zodiac-references.md)
add 27 Sun/Mercury positions and nine motion screens in March/April 2024. Full
charts pass; near-boundary signs and near-zero motion are not falsely certified.
All 404 platform tests pass; combined stored coverage is 267 positions and 89
motion screens. A3 remains open for older/future boundary cases, retrograde zodiac
crossing coverage and final candidate verification. This first slice does not
certify exact station or ingress timestamps.
[Extended boundary references](architecture/astroeye-extended-boundary-references.md)
now cover the planned 1900/2100 boundary examples and a 2025 retrograde crossing.
All 415 platform tests pass; 303 stored positions and 101 motion checks jointly
pass unchanged tolerances. Historical/future time cautions and inconclusive
near-station directions remain explicit. This completes the planned sampling
slice; A3 still needs consolidated candidate verification and evidence review.
More samples are not an automatic prerequisite unless the review identifies a gap.
First A2 evidence: [USNO solar boundaries and planetary-hour checks](architecture/astroeye-sun-boundary-references.md)
now cover six rise/set days, 72 hour midpoints, rounded-boundary rollover probes and
southern polar-day/night cases. The 65N solstice pair verifies long days, short nights and
pre-dawn day ownership, not seasonal transitions or polar day. Broader polar transitions
and broader northern/seasonal coverage remain outstanding; A2 is not closed. The
accepted December 21 southern polar-day reference checks unavailable output at
three instants without fabricated hour fields; it does not certify a full polar season.
The [exact-edge investigation](architecture/astroeye-planetary-hour-boundaries.md)
reproduced query-anchor drift and non-containing intervals in legacy models.
[Model 3](architecture/astroeye-planetary-hour-model-3.md) corrects those defects for
new charts using fixed solar roots and integer half-open partitions; old models
remain replayable. Exact computed-edge tests now pass. Broader independent seasonal
and near-polar transition coverage remain outstanding, so A2 stays open.
The [70N transition pack](architecture/astroeye-sun-transition-references.md) adds
four independent days: a final rise/set pair, last sunrise, continuous daylight
and first returning sunset. It verifies 24 additional midpoints, absent boundaries
and the exact computed switch to unavailable. Returning-sunrise restoration and
broader seasonal coverage remain unverified; A2 is not closed.
Internal returning-sunrise recovery checks now pass for the unavailable-to-hour-1
switch, all 24 resumed computed edges, cache/navigation-order independence and
presentation clearing. They are not external July 27/28 reference evidence; A2
remains open. A3 work can proceed independently of the failed reference retrieval.
First A1 evidence: [published horizon example and geometric regression checks](architecture/astroeye-angle-validation.md).
That first slice covers orientation geometry only; subsequent evidence is listed below.
Follow-up A1 evidence: [two published date/location ASC/MC cases and a full two-system cusp case](architecture/astroeye-published-chart-references.md).
These pass convention-aware comparisons; A1 remains open for polar/near-degenerate
behavior and broader independent quadrant, boundary and geographic/date coverage.
The [polar geometry investigation](architecture/astroeye-polar-caution.md) reproduced
western-intersection and coincident-plane defects in legacy model 1. The versioned
[model 2 correction](architecture/astroeye-polar-model-2.md) selects the eastern branch,
rejects unstable boundaries and uses distinct chart IDs while retaining model-1 replay.
Charts/comparisons still warn from absolute latitude 66 degrees. Independent polar
references and wider boundary coverage remain release blockers; A1 is not closed.
The [published 78N behavior check](architecture/astroeye-polar-reference-behavior.md)
now tests rounded ranges, motion direction and two jumps. This is independent
behavioral evidence, not precise polar UTC/MC/cusp agreement; those fixtures are
still required before closing A1.
Keep reference retrieval separate from offline tests and normal app startup. No Swiss
Ephemeris integration or license purchase is included in this work package.

Checkpoint 58: the [polar numerical candidate review](architecture/astroeye-polar-candidate-review.md)
passes sixteen local model-4 comparisons at both polar caps. Its numerical pack
remains outside Git pending rights review; four checked-in tests exercise synthetic
checker plumbing only. A1 is not closed by this local candidate. L2 must record
redistribution disposition before promotion to public fixtures or release artifacts.
All 422 platform tests pass; A3's candidate decision is unchanged. A2 retrieval
again failed with no accepted response; no gate was waived or newly closed.

Checkpoint 59: [published quadrant/wrap assertions](architecture/astroeye-orientation-references.md)
add four ASC and eleven MC comparisons using the existing Unlicense source and
unchanged 0.36-arcsecond orientation screen. All pass. They advance A1's quadrant
coverage but do not supply polar UTC/cusps or resolve the separate local Swiss
candidate's rights disposition. A1/A2 remain open; no gate is waived. Daily and
annual USNO web retrieval attempts yielded no new reference data.

## 2. AstroEye voice commands

- [x] **V1 — Bounded command contract:** register open/close workspace, select a saved
  event, fly to its venue, set chart preview time, toggle event sky and summarize the
  displayed calculation. Validate arguments, distinguish ambiguous/missing events and
  respect preview bounds and camera/Director ownership. No save/delete/import/export
  command is in this release scope; summaries make no unsupported predictions.
- [x] **V2 — Both transport paths:** wire the canonical command definitions into the
  existing Realtime and free-voice paths, with parity/dispatch/error tests. Treat event,
  provider and note text as data, never instructions. Do not attach the saved collection
  or notebook to model context implicitly; review the minimum data sent for each action.
- [ ] **V3 — Failure and interaction checks:** verify missing provider configuration,
  microphone denial, cancellation, unknown commands and an explicitly authorized live
  smoke check. Manual UI remains usable without voice. Document any external transmission
  and metered usage before the live check; do not purchase services or request secrets in chat.

Current V1/V2 decision: [checkpoint 65 acceptance review](architecture/astroeye-voice-acceptance.md)
accepts the implementation criteria for runtime `19b642f`, backed by 788 passing
tests, 66 parity dispatches, a command-level data review and current isolated-browser
evidence. Checkpoint 67's [offline full-bootstrap assertions](architecture/astroeye-bootstrap-validation.md)
now pass after test-harness corrections. Checkpoint 68 also verifies graceful isolated
browser cleanup and deterministic driver exit. V3 remains open for embedded-host and
explicitly authorized live checks. Earlier pending notes are historical.

Current seam: `src/core/commandRegistry.js`; AstroEye declares seven commands and
registers them when storage is available. Registration alone does not establish
voice transport integration.

Checkpoint 60 adds the [seven-command contract](architecture/astroeye-command-contract.md)
and eight focused tests, including real-controller record preservation. Both catalog
shapes are tested without network calls. Runtime registration, workspace adapters
and transport dispatch are not yet integrated; V1/V2/V3 remain open.

Checkpoint 61 [workspace integration](architecture/astroeye-workspace-commands.md)
now supplies shell registration, rendered chart/sky updates, camera arbitration,
manual cancellation and owner-only teardown. Eight new tests and an isolated
Chromium command/UI check cover this slice; actual voice transports are not yet
exposed. V1 acceptance review and V2/V3 remain open; no gate is closed here.

Checkpoint 62 [voice transports](architecture/astroeye-voice-transports.md) connects
both runners and their catalogs to the canonical seven commands. Offline simulated
transport, cancellation and disclosure work is implemented; V1 review and V2/V3
acceptance remain open, especially host UI and authorized live-provider checks.
Checkpoint 60/61 transport-pending statements above are historical.

Checkpoint 63 adds [isolated browser failure evidence](architecture/astroeye-voice-transports.md#checkpoint-63--simulated-browser-failures)
for missing providers, throttling, microphone denial, privacy disclosure and manual
chart use after failure. Permanent speech errors no longer auto-retry. All 782
regression tests and the bounded Chromium harness pass. This does not exercise the
embedded host, the full fallback MIC binding or a live provider; V1/V2 review and
remaining V3 acceptance stay open. No release gate is closed.

Checkpoint 64 [main-shell fallback evidence](architecture/astroeye-voice-transports.md#checkpoint-64--main-shell-microphone-fallback)
exercises the production binding in isolated Chromium: MIC start/stop, denial/retry,
shortcut detachment, status/help/privacy controls and disposal. Startup now reads
configuration without minting a token. All 787 regression tests and the browser
rerun pass. This is not full-bootstrap, embedded-host or live-provider certification;
V1/V2 review and remaining V3 acceptance stay open.

## 3. Persistent event-linked map research

Checkpoint 71 adds the unmounted [R1 storage foundation](architecture/astroeye-research-annotation-contract.md):
versioned captured records, bounded plain text, atomic stale-write protection and
source deletion/restoration behavior. Six new tests and the related record/notebook/
callout suites pass (25 total). No UI or map wiring yet; R1 review and R2/R3 acceptance
remain open. This non-voice work does not waive the pending live V3 check.

- [x] **R1 — Record contract:** define a versioned local annotation record with stable ID,
  source event reference, captured UTC chart time, coordinates and bounded plain-text note.
  Specify edit/delete behavior, stale-write protection and what happens when its source
  event is deleted/restored. Existing notebook data and session callouts must remain intact.
- [ ] **R2 — Explicit workflow:** add deliberate save/reopen/edit/delete controls and opt-in
  map display. Verify reload restoration, frozen captured time, owner-only cleanup and
  no implicit camera move or chart mutation. Keep rendering bounded and accessible.
- [x] **R3 — Recovery and privacy:** round-trip durable annotations through full backup
  and reviewed import, including conflicts and unsupported versions. Keep them out of
  matching-event exports, comparison reports, share URLs and tours unless a later explicit
  scope change adds a reviewed sharing flow. Test deletion/undo behavior and failed writes.

This is one event-linked annotation slice, not a complete Research Mode case/project system.
Current R1/R3 decision: [checkpoint 78 candidate review](architecture/astroeye-research-acceptance.md).
Earlier open-status descriptions are historical; R2 remains unaccepted.
See [current session-callout behavior](architecture/astroeye-event-callouts.md).

## 4. Complete workflow and usability

Checkpoint 84 adds [passing composed Director-workspace evidence](architecture/astroeye-director-workspace-validation.md):
three-shot handoff, Stop/Escape, focus return and complete playback restore the
saved preview time without changing event/private-workspace or project bytes.
Private research is excluded from tours/telemetry. The real engine and adapter run
over simulated camera/style seams with extracted production visibility rules.
First browser attempt passes with graceful cleanup; 70 focused tests pass. U1/U2
remain open for actual-host/map and remaining usability acceptance, not implicitly
closed by this relay-backed test. U3 performance baselines remain next.

Checkpoint 83 adds [passing synthetic provider-form evidence](architecture/astroeye-provider-workspace-validation.md):
explicit review, edit invalidation, repeated-hour time preservation, missing-coordinate
refusal and manual fallback preserve private research. Final relay-backed browser
run exits 0 with graceful cleanup; 46 focused tests pass. Earlier fixture/cleanup
failures are documented. This does not certify live providers, default transport,
Director or embedded-host behavior; U1 remains open and no new gate is accepted.

Checkpoint 82 provides [passing relay-backed manual/share evidence](architecture/astroeye-manual-share-validation.md#checkpoint-82--pending-requests-identified-relay-backed-workflow-passes):
all functional assertions and graceful browser cleanup pass with explicit
`--node-assets`; 48 focused tests pass. Default browser module requests still stall,
so this does not certify normal transport, the embedded host, full bootstrap or
the remaining provider/Director U1 steps. No additional gate is closed.

Checkpoint 81 [isolates startup import latency](architecture/astroeye-manual-share-validation.md#checkpoint-81--startup-stall-isolated-failed-mount-cleanup-repaired)
and repairs failed-mount page tracking in the test harness. The focused 20-second
mount diagnostic times out before storage setup, then closes gracefully; all six
cleanup unit tests pass. This is diagnosis/cleanup evidence, not a passing U1
workflow or resolution of the underlying module-loading/evaluation delay.

Checkpoint 80's [manual form/share diagnostic](architecture/astroeye-manual-share-validation.md)
is **incomplete**, not accepted U1 evidence. Functional assertions passed once but
browser cleanup failed; a final retry exited 1 without a completion report.
Retries stopped, and phase diagnostics were added without another browser run.
42 focused regressions pass; runtime and release-gate decisions are unchanged.

Checkpoint 79 adds an in-app Quick start guide and [combined workspace evidence](architecture/astroeye-quick-start-validation.md).
Guide/shortcut keyboard access, narrow layout and comparison-pin preservation
through chart changes and note saving pass; 461 platform tests pass. Final isolated
browser retry exits 0 with graceful cleanup after one shutdown-timeout failure.
U1/U2 remain open: this is seeded-controller data and a mocked viewer, not complete
manual/provider/share/Director/embedded-host acceptance.

- [ ] **U1 — End-to-end acceptance:** with isolated synthetic data, exercise manual entry,
  provider-to-reviewed-form handoff, selection/time preview, map, comparison, annotations,
  notes, export/import and deletion recovery. Verify share restoration in a fresh browser
  and the Director event-tour handoff/stop behavior without leaking private research.
- [ ] **U2 — Accessible and discoverable:** verify keyboard-only navigation, focus/escape
  behavior, labels/status announcements, reduced motion and narrow/wide layouts. Provide
  a short first-use guide that makes Compare charts, Saved events and Research notes easy
  to find. Check host-specific downloads/leave warnings in a disposable embedded session
  when available; record unsupported behavior without promising crash recovery.
- [ ] **U3 — Performance and regression:** establish a measured baseline and acceptance
  budget for supported collection sizes, map caps and chart/time changes. Verify no
  per-frame ephemeris work, stale-response safety and unchanged shared layer/camera behavior.
  Fix regressions or document explicit, reviewed support limits.

Checkpoint 85 provides [synthetic CPU baselines](architecture/astroeye-performance-baseline.md)
and a tested one-parse-per-record sort/empty-search optimization. 25/100/1,000 and
10,000-event stress cases pass correctness checks; all 464 platform tests and three
statistics tests pass, as does the production build. Timing samples exclude actual
storage, DOM/GPU rendering and host delivery, and do not establish support limits
or an accepted timing budget. U3 remains open pending mounted/actual-host measures
and its remaining per-frame/shared-state audit.

Checkpoint 86 adds [mounted workspace/native-storage observations](architecture/astroeye-browser-performance.md)
for 100 and 1,000 synthetic events. Both first browser runs pass with graceful
cleanup, unchanged backups and database-connection reopen checks; 18 focused tests
pass. UI measurements end after an animation frame plus root layout, not actual
screen presentation. Same-event cached selection is the slowest measured 1,000-event
path (206 ms median, 405.6 ms maximum of five samples). U3 remains open: profile
that path, preserve freshness, and extend actual-host/representative-case evidence
before accepting support limits or budgets. Runtime is unchanged in this checkpoint.

Checkpoint 87 [profiles the selection stages and removes a redundant list copy](architecture/astroeye-browser-performance.md#checkpoint-87--selection-stage-profile-and-redundant-copy-removal),
without skipping fresh reads or changing schema. Native returned-object isolation
and unit cross-connection freshness checks pass. All 466 platform tests and the
production build pass; both browser profiles exit 0 with graceful cleanup. Timing
differences are observational and confounded by run variability. U3 remains open
for representative uncached/venue cases, actual-host costs and per-frame/shared-state
review before accepting device, collection and timing budgets.

Checkpoint 88 [extends cache-miss coverage to varied venues](architecture/astroeye-uncached-performance.md).
All twelve venue/house combinations pass at 100 synthetic events with graceful
cleanup, exact times, polar cautions and no record/chart writes. The 1,000-event
attempt reached its unchanged 60-second watchdog and remains incomplete. Twelve
focused tests pass; runtime is unchanged. This is a warmed-app read-only cache-miss
path, not cold startup or default chart persistence. U3 support/budget acceptance
and larger/actual-host coverage remain open; use bounded case batches next.

Checkpoint 89 [completes twelve 1,000-event combinations in bounded batches](architecture/astroeye-uncached-performance.md#checkpoint-89--bounded-1000-event-batches).
Three independent batches exit 0 with graceful cleanup and unchanged synthetic
records, explicit polar state and no case-chart writes. Dedicated batches skip
baseline timing loops; a separate 25-event unbatched regression passes. Fourteen
focused tests pass; the 60-second watchdog and runtime are unchanged. This adds
larger-collection functional/timing observations, not a single-run full-pack pass,
actual-host/GPU evidence or support/budget acceptance. U3 remains open for the
per-frame/shared-state audit and actual-host acceptance work; five gates accepted,
ten open overall.

Checkpoint 90 [audits idle work and shared-state boundaries](architecture/astroeye-idle-state-audit.md).
Source inspection finds event-driven chart work; ring spies confirm cached
directions avoid live Sun/Moon calculations across 120 synthetic method calls.
Read-only presentation guards and controller snapshot tests retain other-module
state and record bytes. A reproduced shared-clock validation defect is fixed:
rejected time/mode changes no longer partially commit. All 472 platform tests and
the production build pass. This is source/unit evidence, not an actual-host idle
or GPU trace. U3 remains open for host measurements and supported-device,
collection-size and timing-budget acceptance; five gates accepted, ten open.

Checkpoint 91 adds an opt-in [passive ten-second host observer](architecture/astroeye-render-check.md).
The panel counts existing post-render callbacks and minimal governor/sky counters
without forcing frames or accessing records. Unit coverage verifies cancellation,
timing-window and privacy boundaries; all 480 platform tests and build pass.
Actual browser connection failed before tab access with a request-header-policy
load error. No actual-host UI/timing result is claimed; the user-run report remains
pending. U3 is still open and this observer is not a GPU/FPS acceptance benchmark.

## 5. Release engineering

- [ ] **L1 — Reproducible candidate:** clean install on the declared Node version, production
  build, complete unit results and relevant browser checks tied to the candidate commit.
  Add a CI workflow (none exists under `.github/workflows` at this baseline). Record failures,
  skips and known limitations; an old upstream status report is not fresh release evidence.
- [ ] **L2 — Security and rights:** audit actual new routes, input/response limits, secrets,
  provenance and visible credits. Record a current license/terms disposition for retained
  providers/data/assets and the intended deployment profile. Verify map-provider recording
  restrictions for enabled paths; disable or gate unsupported export paths. This requires
  a current review, not reliance on the initial audit's legal/provider statements.
- [ ] **L3 — Deployment and handoff:** on an explicitly approved target, smoke-test manual
  keyless operation and optional-provider failures, prepare backup/restore and rollback
  instructions, publish known limitations and release notes, then request approval to tag
  and publish `v0.1.0-astroeye`. No hosting purchase or public deployment is preauthorized.

## Evidence and bounded execution

For each gate record: candidate commit, test/inspection command or procedure, date,
environment, result, evidence location and residual limitation. A checkbox changes only
when that evidence covers the entire criterion. The original planning checkpoint closed
no gates; checkpoint 57 closes A3 for the recorded candidate, with revalidation required
after relevant changes.

Use small test groups and isolated browser profiles, not the user's saved data or open
preview. Browser jobs require a whole-run watchdog of at most 60 seconds and cleanup of
only their owned resources. Split larger scenarios into separately bounded checks before
running them; do not restart long globe/tour loops or run browser checks alongside builds.
Report failures promptly and leave the worktree recoverable.

Existing entry points (not a claim that they were all rerun for this checklist):

- `node scripts/astroeye-horizons.mjs` — stored reference comparison, offline.
- `npm run test:platform` — module, storage and calculation tests.
- `npm test` — inherited unit runner; inventory/split if necessary for bounded execution.
- `npm run build` — production build.
- `npm run qa:astroeye-browser-safety` — real file downloads and native leave warnings.
- `scripts/qa-astroeye-*.mjs` — scenario-specific checks; inspect timeouts and prerequisites
  before running, especially rendered-globe, share and tour scenarios.

## Explicitly deferred beyond v0.1

More leagues and historical backfills; live-score dashboards; player birth data; advanced
house systems/fixed-star or astrocartography features; saved comparison projects; map
clustering beyond current limits; generalized evidence/case management; accounts, cloud
sync and collaboration; automated betting or prediction models; hardware control; broader
video-export workflows. These do not reopen the v0.1 checklist automatically.

## Execution order and what follows

User-approved sequence change (September 13 local): proceed with **V1–V3** while
remaining A1/A2 evidence and fixture-rights review stay mandatory release blockers.
A3's current-candidate review is complete. No calculation gate is waived.
Then R1–R3, U1–U3 and L1–L3, carrying relevant regression evidence forward and
rerunning affected checks after changes. Required provider/user approvals may pause a gate;
they are not permission to silently remove it.

After AstroEye release, the proposed sequence is Sports Command, expanded Research Mode,
then AstroTrace. Sound Radar, Cosmic Watch, Director Mode, Collector Radar and RC Command
remain planned modules whose order the user can choose. Existing radio, Earth/space feeds,
scene director and shared services are foundations, not completed versions of those modules.
