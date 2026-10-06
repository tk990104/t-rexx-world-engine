# AstroEye end-to-end workflow acceptance

October 6, 2026 — checkpoint 143. **U1 is accepted** for the user-approved
personal-local, standalone Chromium target. Eight release checks are accepted;
seven remain open. This is engineering acceptance against U1's existing criteria,
not whole-release certification or permission to publish/deploy.

## Candidate and scope

Runtime: `06f1ccd`, unchanged this checkpoint. The new runner
`scripts/qa-astroeye-full-app-workflow.mjs` serves the production `dist` entry and
assets without replacing the document, controllers, storage, scene engine, camera
or styles. Every phase checks the same production index SHA-256:
`00812a9557e05225542adeceaf1814e235ba7a99d85d97a4ee8a51efb554a208`.
This is the identical build used by [R2 acceptance](astroeye-note-workflow-acceptance.md).
No application fix, schema change, feature removal or calculation change was needed.

Windows / standalone headless Chromium `145.0.7632.77`, normal graphics,
1280×900 viewport. One synthetic sender profile, a separate empty recipient
profile, and a separate synthetic provider profile; no user profile/records were
opened. Director reopens the sender profile on the same loopback origin.

## U1 criterion-to-evidence review

| Criterion | Accepted evidence |
| --- | --- |
| Manual entry | Real form refuses an ambiguous November 1, 2026 New York 01:30 until the second occurrence is selected. Stored instant is 06:30 UTC and Equal-house chart renders. |
| Provider-to-reviewed-form | Synthetic HTTP schedule/venue responses enter the production adapter/form. Time-zone hint does not choose a zone, 06:30 UTC is preserved, unreviewed submission cannot save, editing clears approval, reviewed save retains provenance. Missing venue coordinates refuse saving; New/manual fallback creates a separate manual event. No live-provider claim. |
| Selection/time preview and comparison | Saved-event selection works through its rendered button. Pin stays at 06:30 while preview advances through 06:45 to 07:00 without adding stored charts. The actual comparison report contains both instants, not private research. |
| Map and annotations | Reuse R2's same-build actual OSM/Re:Earth rendering, marker pixel/picking/opt-in/delete/Undo and native reload evidence, along with bounded owner-only cleanup tests. Current full-app run additionally integrates a manual chart and actual Director/Cesium camera. |
| Event notes and notebook | Draft note captures 06:45, then saves after preview advances to 07:00 without recapture. Private plain text and separate notebook survive exact backup restoration and recipient reload. |
| Export/import and deletion recovery | Browser-generated comparison, full-backup and matching-event files arrive in the isolated QA download directory. Full backup exactly equals serialized storage; matching/comparison exports exclude private text. Delete/Undo restores exact event/chart/research bytes without camera change. Import review and cancellation do not write; explicit confirmation restores exact backup. |
| Fresh-browser share | New empty native profile opens the actual generated share URL. Restored snapshot is exactly equal to the sender's selected view; chart renders, delete is unavailable, events and research remain unsaved/empty. Only a subsequent deliberate backup import restores private records. Reload preserves those imported notes. |
| Director handoff/Stop and privacy | Actual production three-shot tour appends without replacing existing scenes; every shot preserves calculation inputs and leaves unrelated layers undeclared. Stop and Escape restore panel/focus and frozen -60-minute view. All three real camera shots complete with the expected final 40°N, 75°W, 12,000m camera pose. Records/project remain exact; private research is absent from project and telemetry. |

The linked R2 evidence plus these composed production-app runs cover every U1 row.
Earlier U1-open statements in checkpoints 123–142 are historical. Earlier
[everyday](astroeye-everyday-workflow.md),
[provider](astroeye-provider-workspace-validation.md) and
[Director](astroeye-director-workspace-validation.md) fixture evidence is retained
for extra failure/interaction coverage, not relabeled as full-app evidence.

## Passing runs

Final session: `qa-shots/astroeye-full-app-workflow/session-WTzVs8/`.
Each phase exits 0, has no page errors, and closes only its owned browser/server:

| Phase | Passing outcome | Graceful cleanup |
| --- | --- | ---: |
| workflow | Manual ambiguity, comparison, both notes, native downloads, delete/Undo and reviewed import | 1.430s |
| recipient | Fresh read-only share, explicit backup import, reload and private-note restoration | 1.625s |
| provider | Required/invalidation review, source metadata, venue failure and manual fallback | 1.357s |
| director | Real three-shot camera/visual integration, Stop, Escape, completion and privacy | 1.890s |

All external traffic is blocked. The provider phase intercepts exactly one
schedule and two venue calls with synthetic responses. Other app API paths return
offline/unconfigured responses; microphone/socket transmissions are disabled.
No keys were read or changed, no metered calls occurred, and port 5173/user preview
was not controlled. Every browser process has a 60-second whole-run watchdog;
no forced termination occurred in these runs.

Reproduce serially after building the candidate:

```text
node scripts/qa-astroeye-full-app-workflow.mjs --phase=workflow
node scripts/qa-astroeye-full-app-workflow.mjs --phase=recipient --session=<printed-session-name>
node scripts/qa-astroeye-full-app-workflow.mjs --phase=provider --session=<printed-session-name>
node scripts/qa-astroeye-full-app-workflow.mjs --phase=director --session=<printed-session-name>
```

Reports, manifests and synthetic downloaded files remain ignored local QA
artifacts; native profiles are in separate OS temporary directories. No fixture
data is committed. Syntax, documentation links/tally and diff checks pass.
Production code/build identity is unchanged: no new build, full-unit/allocation
suite or hosted CI run is claimed. Hosted CI remains scoped to `eb1a716`.

## Failed attempt and limits

The initial workflow attempt reached comparison export but no file arrived in
five seconds; cleanup was graceful (2.151s). The successful retry opens the
comparison section and uses a real pointer click on its download button instead
of a programmatic click in another section. No runtime change or timeout increase
was made. This resolves that test failure, not proof of every host's download
behavior; the failed run is not counted as a pass.

Import uses a synthetic File/DataTransfer through the actual input change handler,
not a native operating-system file picker. Downloads are real files with browser
delivery directed to an isolated folder; native dialogs/leave warnings and screen
readers remain U2. Director runs normal actual camera/visual behavior with remote
map requests blocked; R2 supplies the separate real-terrain evidence. This does
not test every provider/map state, GPU, locale, concurrency limit or dataset size.

Embedded preview remains explicitly unverified. A1/A2 independent accuracy, V3
live voice, U2 accessibility/usability, U3 performance, L2 security/rights and L3
local-release handoff remain open. No approval is inferred for deployment, new
pushes, audio transmission or paid-provider use. Next: consolidate the remaining
U2 checks against the chosen browser, reusing the current keyboard/download/focus
evidence and recording genuine manual-only limitations.
