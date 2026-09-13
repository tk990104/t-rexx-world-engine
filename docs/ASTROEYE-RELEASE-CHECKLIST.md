# AstroEye v0.1 release checklist

Scope baseline: 2026-09-12, implementation checkpoint 34 (`92edee7`).

**Status: pre-release; 15 acceptance gates remain open across five work packages.**
These are grouped outcomes, not an estimate of commits or development days. Existing
features and earlier passing tests are useful evidence, but do not close a release
gate until the complete criterion has been verified on the release candidate.
The `0.1.0` package/manifest version and `mvp` manifest label are not release certification.

## Finish line

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
- [ ] **A3 — Supported range:** document and consistently handle the supported date range;
  add station, zodiac-boundary and historical-zone samples appropriate to that range.
  Rerun deterministic internal tests and stored external position comparisons. Describe
  sampled agreement, not universal accuracy or predictive validity.

Start with the existing [validation backlog](architecture/astroeye-validation.md).
First A2 evidence: [USNO solar boundaries and planetary-hour checks](architecture/astroeye-sun-boundary-references.md)
now cover six rise/set days, 72 hour midpoints, rounded-boundary rollover probes and one
southern polar-night case. The 65N solstice pair verifies long days, short nights and
pre-dawn day ownership, not seasonal transitions or polar day. Broader polar transitions
and accepted external polar-day data remain outstanding; A2 is not closed.
The [exact-edge investigation](architecture/astroeye-planetary-hour-boundaries.md)
reproduced query-anchor drift and non-containing intervals in legacy models.
[Model 3](architecture/astroeye-planetary-hour-model-3.md) corrects those defects for
new charts using fixed solar roots and integer half-open partitions; old models
remain replayable. Exact computed-edge tests now pass. Broader independent polar-day
and near-polar transition coverage remain outstanding, so A2 stays open.
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

## 2. AstroEye voice commands

- [ ] **V1 — Bounded command contract:** register open/close workspace, select a saved
  event, fly to its venue, set chart preview time, toggle event sky and summarize the
  displayed calculation. Validate arguments, distinguish ambiguous/missing events and
  respect preview bounds and camera/Director ownership. No save/delete/import/export
  command is in this release scope; summaries make no unsupported predictions.
- [ ] **V2 — Both transport paths:** wire the canonical command definitions into the
  existing Realtime and free-voice paths, with parity/dispatch/error tests. Treat event,
  provider and note text as data, never instructions. Do not attach the saved collection
  or notebook to model context implicitly; review the minimum data sent for each action.
- [ ] **V3 — Failure and interaction checks:** verify missing provider configuration,
  microphone denial, cancellation, unknown commands and an explicitly authorized live
  smoke check. Manual UI remains usable without voice. Document any external transmission
  and metered usage before the live check; do not purchase services or request secrets in chat.

Current seam: `src/core/commandRegistry.js`; AstroEye's manifest command list is empty.
The registry's existence alone does not establish voice integration.

## 3. Persistent event-linked map research

- [ ] **R1 — Record contract:** define a versioned local annotation record with stable ID,
  source event reference, captured UTC chart time, coordinates and bounded plain-text note.
  Specify edit/delete behavior, stale-write protection and what happens when its source
  event is deleted/restored. Existing notebook data and session callouts must remain intact.
- [ ] **R2 — Explicit workflow:** add deliberate save/reopen/edit/delete controls and opt-in
  map display. Verify reload restoration, frozen captured time, owner-only cleanup and
  no implicit camera move or chart mutation. Keep rendering bounded and accessible.
- [ ] **R3 — Recovery and privacy:** round-trip durable annotations through full backup
  and reviewed import, including conflicts and unsupported versions. Keep them out of
  matching-event exports, comparison reports, share URLs and tours unless a later explicit
  scope change adds a reviewed sharing flow. Test deletion/undo behavior and failed writes.

This is one event-linked annotation slice, not a complete Research Mode case/project system.
See [current session-callout behavior](architecture/astroeye-event-callouts.md).

## 4. Complete workflow and usability

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
when that evidence covers the entire criterion. This planning checkpoint closes no gates.

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

Next: **A1, then A2/A3**. Finish validation before expanding voice or annotation scope.
Then V1–V3, R1–R3, U1–U3 and L1–L3, carrying relevant regression evidence forward and
rerunning affected checks after changes. Required provider/user approvals may pause a gate;
they are not permission to silently remove it.

After AstroEye release, the proposed sequence is Sports Command, expanded Research Mode,
then AstroTrace. Sound Radar, Cosmic Watch, Director Mode, Collector Radar and RC Command
remain planned modules whose order the user can choose. Existing radio, Earth/space feeds,
scene director and shared services are foundations, not completed versions of those modules.
