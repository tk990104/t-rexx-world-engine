# Persistent research annotations — shared-location labels, checkpoint 77

Status: **mounted in AstroEye through the Event notes quick-navigation button**.
The existing Research notes button still opens the separate notebook. Optional
read-only note markers are available and off by default. Browser verification uses
isolated synthetic profiles, not user data.
R1 record-contract and R3 recovery/privacy acceptance are recorded in the
[checkpoint 78 review](astroeye-research-acceptance.md) for runtime `8bb14d9`.
R2 is now accepted in the [checkpoint 142 full-app review](astroeye-note-workflow-acceptance.md)
for user-approved personal-local standalone Chromium; embedded preview remains
unverified. Earlier R2-open statements below are historical. Live V3 testing remains separately approval-gated; it is not waived while
this independent, non-voice work proceeds.

## Record and ownership

`researchAnnotations.js` owns one workspace record, `astroeye-event-annotations-v1`,
with kind `astroeye-event-annotations`, schemaVersion 1, and an `annotations` array.
Each annotation contains exactly:

| Field | Contract |
| --- | --- |
| id | Stable `astroeye-note:` ID; default suffix is a UUID |
| schemaVersion | 1 |
| eventId | Captured source event ID, bounded to 200 characters |
| chartTimeUtc | Captured chart/preview time as canonical UTC ISO milliseconds |
| latitude / longitude | Captured finite numeric coordinates, ±90 / ±180 |
| note | 1–2,000 UTF-16 code units, nonblank plain text; line breaks/tabs allowed |

The collection is capped at 100 annotations. These are initial storage bounds, not
an established map-performance budget. Duplicate IDs, sparse entries, extra fields,
malformed coordinates/timestamps and unsupported versions are refused. Unknown
saved data is not silently normalized, migrated or overwritten.

Capture copies only those fields and requires the chart's eventId to match the
event. It does not calculate a chart, assert numerical accuracy, recapture later
previews, or retain a reference to the live selection. It validates reference
identity, not the source's continued existence; deletion can race with capture.
Future UI must make saved-source selection and missing-source states explicit.

## Mutation and deletion

- `load()` has no write side effects and returns detached data (null if absent).
- `add`, `edit`, and `remove` require the entire last-loaded collection as their
  expected baseline (explicit null only for initial creation). The existing
  `saveWorkspaceIfUnchanged` transaction compares it atomically with stored data.
  Concurrent initial creation, stale edits and stale deletes cannot overwrite a
  winning update. This conservative collection-wide conflict policy can reject
  edits to different annotations; there is no automatic merge or retry.
- Edit changes only note text; ID, time, event reference and coordinates remain
  captured values. A changed capture must be a new annotation.
- Remove deletes only the requested annotation from this collection. Removing the
  last entry leaves an empty collection, so stale initial-create baselines still
  conflict. Checkpoint 73 adds restoration and session-only undo, described below.
- Source event deletion does not cascade into annotations. `sourceState` reports
  `source-missing`; same-ID restoration reports `source-present`. This means the
  reference resolves, not that all restored event contents are identical. Captured
  time, coordinates and note never change during this lifecycle.
- Quota/transaction errors propagate without mutating the caller's draft/baseline.
  The user must retain a failed draft before any later refresh in the eventual UI.

The service receives only the record store. It cannot change the camera, clock,
chart selection, shared annotation board or notebook. Existing session callouts
remain session-only and separate. It is not registered in voice catalogs.

## Checkpoint 71 verification and remaining work at that point

**25 focused tests pass** (18.754 seconds), no failures, skips or TODOs: six new
annotation tests plus existing record-store, notebook and event-callout tests.
They use fake IndexedDB with synthetic records, not the user's browser database.
Coverage includes exact text/snapshot copies, empty read behavior, stale/concurrent
writes, scoped deletion, source deletion/undo, preserved notebook/event bytes,
limits, malformed/future data and injected write failure. Syntax/diff checks pass.
No production build or full-app suite was rerun: the new service is not imported
by the application entry point, so current runtime behavior is unchanged.

The next planned work was explicit save/reopen/edit/delete UI, frozen snapshot labels, missing-source
messages and opt-in bounded map display. Before exposing the workflow, extend
recovery/privacy tests for reviewed import, conflicts, unsupported records and
exclusion from matching exports, reports, links and tours. Generic workspace backup
plumbing already exists, but it is not R3 acceptance for this new record contract.

## Checkpoint 72 — staged editor and isolated browser verification

`researchAnnotationsPanel.js` implements a separately mountable editor. It receives
only the annotation service, confirmation and draft-download functions: no camera,
clock, chart controller, voice or map capability. It is deliberately not imported
by `main.js` or mounted in the AstroEye workspace yet.

- Explicit New note captures the selected saved chart's time and coordinates before
  its asynchronous source check. Shared/invalid selections cannot start notes;
  missing sources are refused at creation. A later deletion still preserves a note.
- Opening the panel loads without writing. Opening a saved entry shows read-only
  captured details and checks whether its source currently exists. Source lookups
  use a generation guard so an older response cannot replace a newer result.
- Saving creates or edits only on request. Selecting another note, reloading, or
  starting another draft asks before discarding dirty text. Panel hide/reopen retains
  drafts. Quota, read, stale-save and stale-delete failures preserve the draft.
- At checkpoint 72, deletion required explicit confirmation and had no annotation
  undo. Checkpoint 73 adds session-only undo; full backups remain needed for longer-term recovery. Draft downloads contain
  only editor text, not an importable backup or captured coordinates/time.
- Dynamic text uses textContent/value, not HTML. A dirty editor requests the same
  bounded browser leave warning as the notebook. Destroy removes its own handlers;
  a write already underway may complete, but cannot resurrect detached UI.

Verification: `node scripts/qa-astroeye-annotations.mjs` passes with exit 0 in a fresh
headless browser, using synthetic IndexedDB records and blocked external/provider
requests. It tests create/reopen after remount/edit/scoped-delete, exact inert text,
frozen captures including delayed reads, new-draft focus, cancellation, draft
download, read/quota failures, stale writes/deletes, missing/restored sources,
out-of-order source responses and destruction during a pending save. Final cleanup
was graceful (0.738 seconds), without forced termination. **23 focused regression
tests pass** (16.790 seconds): annotation service, notebook, session callouts,
unsaved-note guard and browser-cleanup helper. Syntax and diff checks pass.

This is component QA, not a full reload/embedded-host, production styling, keyboard
accessibility audit, Director integration or full-app acceptance. No production
build/full suite rerun is claimed because the new editor remains unmounted. No
user records, credentials or live providers were accessed; nothing was published.

Next at checkpoint 72: annotation-specific backup/reviewed-import/privacy coverage and deletion
recovery, then wire the editor into the workspace with selection lifecycle and
Director checks. Opt-in map display follows separately. No R1/R2/R3 gate is closed.

## Checkpoint 73 — recovery and privacy candidate

The service now exposes `restore(entry, expectedCollection)`. It appends a validated,
detached entry with its original ID, text, UTC time and coordinates. It refuses an
existing same-ID record, a stale expected collection, malformed records or a full
100-note collection. The operation is one atomic compare-and-save transaction; it
never creates a missing source event, overwrites a newer note or edits the notebook.
Original list position is not restored: recovered entries are appended.

The staged editor now offers **Undo last note deletion**. Only a successful delete
replaces its in-memory recovery slot, containing saved text rather than discarded
unsaved edits. A successful undo consumes it; failed undo leaves it available for a
deliberate retry after reloading/reviewing current storage. Panel hide/reopen and
Reload saved event notes retain the slot; destroying/remounting the editor or
reloading the page clears it. Undo asks before discarding a different dirty draft.
Full Export all backups remain necessary for recovery beyond this session.

Six new fake-IndexedDB tests verify:

- Full backup and single-use reviewed import preserve exact annotation bytes,
  including orphan notes, without fabricating sources or changing other workspaces.
- Import reviews are read-only. Existing collection replacement requires explicit
  overwrite acknowledgement; a newer local change invalidates approval atomically.
  Acknowledged imports replace the entire annotation workspace, **not merge notes
  individually**. Notes absent from the incoming collection are removed. This is
  the existing generic workspace-import contract; the staged editor now warns of it.
- Unknown future and malformed annotation payloads round-trip as opaque workspace
  backup data. The annotation service refuses to read/edit these formats. Import
  transport does not certify their validity or silently migrate them.
- Restoration preserves exact captures, other entries and caller snapshots, with
  no writes on same-ID/stale conflicts, invalid data, cap limits or injected failure.
- Matching-event exports, comparison reports, decoded view links and Director tour
  payloads remain byte-identical before/after adding a private annotation collection.
  Full backups intentionally include that collection; review them before sharing.

**49 focused tests pass** (8.093 seconds): new recovery/privacy tests and existing
annotation, import-review, notebook, callout, store, leave-guard and cleanup tests.
The expanded isolated browser harness passes with exit 0 and graceful 0.584-second
cleanup. It verifies session undo, failure/retry, stale and same-ID refusal, recovery
of saved rather than unsaved text, and undo loss on remount, alongside checkpoint-72
checks. Syntax/diff checks pass. Only synthetic test databases were used.

At checkpoint 73 the editor was still unmounted. Next was actual workspace navigation/selection and
Director-safe integration, including import-review privacy wording, styling and
browser validation. No full-app build, embedded-host acceptance, live voice, release
gate closure, user-record access or publication is claimed. Map display remains separate.

## Checkpoint 74 — main-workspace integration

Use **AstroEye → Event notes**. Choose a saved event chart, optionally change its
preview time, then choose **New note from selected chart**, enter text and choose
**Save event note**. Reopen a saved note from the dropdown; Delete and Undo last
note deletion operate only on notes. Research notes remains the separate notebook.
Save any unsaved work before refreshing an older preview to load these controls.

`main.js` now provides the annotation service to `mountAstroEyeWorkspace`. The
collection is not read on startup or chart selection; the user must open Event
notes. Chart changes update only the candidate for the next new note, never the
existing draft's capture. Notes remain available without a selected chart; creating
one requires a saved-source chart. Shared/Director scene previews cannot be captured
until saved as an event. Note opening/saving never moves the camera or selects a chart.

The workspace observes its busy state and the Director playback class; the main
callback also checks `sceneDirector.running`. During suspension the note section is
hidden and new actions are refused, including synthetic clicks bypassing disabled
buttons. Drafts and session undo remain in memory. A generation guard prevents a
delayed New note source check from replacing a draft after playback has started,
even if that response arrives after playback ends. Already-started writes may finish;
they are not silently cancelled. Observer/listener cleanup occurs on workspace destroy.

Import review now explicitly warns that workspace replacement can replace the whole
private note collection and remove notes absent from the incoming file. Imported
notes do not overwrite an open draft; a stale save is rejected until deliberate
review/reload. The editor has bounded controls and wrapping styles for narrow screens.

Verification:

- All **454 platform tests pass**, no skips/TODOs (32.179 seconds).
- Final production build passes (22.80 seconds); existing node:fs browser-externalization
  and large-chunk warnings remain. This is not the entire `npm test` suite.
- `qa-astroeye-annotation-workspace.mjs` passes with exit 0: keyboard navigation,
  actual workspace/controller chart switching, frozen preview capture, no navigation
  on note save, close/reopen drafts, Director signal/scene-adapter suspension, delayed
  capture rejection, real document reload and IndexedDB reopen, separate notebook,
  escaped text and 390px editor overflow checks. Final cleanup is graceful (0.783s).
- The standalone editor regression harness also passes, including undo/conflicts,
  failures and async destruction, with graceful cleanup (0.666s).

Initial integration runs misclassified six embedded calendar/clock SVG data images
as external requests; the harness now permits only this local image type while
continuing to block external/API requests. One later run passed workflow assertions
but exited 1 after the owned test browser exceeded its 10-second close deadline;
the bounded guard stopped that process. A serial retry exited 0 with normal cleanup.
No shutdown threshold was relaxed and no user browser was controlled.

These harnesses mount the real workspace, not full globe bootstrap or the actual
embedded browser. Director signals and adapter calls are tested, not a complete
cinematic playback session. No user records, live providers or credentials were
accessed; nothing was published. R1/R2/R3 acceptance remains open. Next is opt-in
bounded note-marker display and remaining release/embedded-host verification.

## Checkpoint 75 — opt-in read-only globe markers (September 15)

Use **AstroEye → Event notes → Show note markers**, then close the workspace to
see the globe. This does not move the camera. Amber points show saved capture
locations; nearby labels show exact captured UTC times, not note text or source
event details. These first markers are read-only, with no note-opening click handler.
Multiple captures at the same location can overlap. Hide note markers removes them;
Refresh note markers rereads saved data without changing the editor draft.

`researchAnnotationLayer.js` owns a separate set of Cesium entities. It is not
registered in the shared annotation board, URL layer catalog or Director recipe.
The opt-in flag lives only in memory and never enters record exports, links or tours.
Full backups still contain the saved note collection as described above. Note text
and source event IDs are not copied into marker names, labels or entity properties.

- No record reads before explicit activation. Empty collections create no records.
  Saved capture coordinates/time are used without recapturing a current chart.
- The existing 100-note schema bound is enforced, not silently truncated. Invalid,
  oversized or future collections and read/render failures clear the layer and show
  a generic error without changing stored records. Old markers clear during refresh.
- Panel save/delete/undo/reload and reviewed imports refresh an enabled layer.
  Other browser tabs require explicit Refresh note markers. This is not live sync.
- Director playback or an unsaved shared/scene view disables and clears markers,
  invalidating in-flight reads. Leaving that mode never automatically reenables them;
  the user must select an eligible view and explicitly show them again. Reload also
  starts off. Frozen notes can remain mapped even if their source event was deleted.
- Picking is registered with the shared ownership registry so sibling tracking
  layers can leave these picks alone. No new pointer handler, timer, camera call,
  world-clock operation, chart calculation or record write is added by the layer.
- Cleanup checks entity identity before removal, so a foreign entity that reused
  a former marker ID is preserved. Destroy disconnects its observer/subscriptions,
  unregisters pick ownership and invalidates pending work.

Verification: all **460 platform tests pass** (24.773 seconds), including six new
tests using a real Cesium EntityCollection for capture coordinates, privacy fields,
100-note bounds, stale reads, opt-in safety, import refresh, errors and scoped
cleanup. An initial identity-reuse test caught Cesium removal by ID; the explicit
identity check fixes it and the test now passes.

Expanded isolated workspace browser QA passes with exit 0 and graceful 1.354-second
cleanup. It checks controls, no writes/navigation on activation, delete/undo/import
refresh, playback/shared-view exclusion and disabled state after real page reload.
The browser harness uses a mocked viewer; entity construction is tested separately
with Cesium. The production build passes (12.32 seconds), retaining existing
node:fs browser-externalization and large-chunk warnings. Syntax/diff checks pass.

No real-user records, live providers, credentials or publication were involved.
Actual WebGL appearance, overlapping-marker usability and embedded-host acceptance
still need verification. These checks do not certify GPU performance or close
R1/R2/R3. Next: embedded-globe visual/interaction checks and remaining release gates.

## Checkpoint 76 — offline WebGL reference scene (September 15)

`node scripts/qa-astroeye-marker-render.mjs` now renders the production note layer
in a real Cesium 3D viewer, using three synthetic in-memory notes and an opaque,
synchronous WGS84 reference mesh. No user profile, IndexedDB records, imagery,
external feeds or API requests are used. The actual terrain globe is disabled in
this fixture: asynchronous terrain readiness was inconsistent in earlier attempts,
so this is explicitly **reference-mesh evidence, not terrain acceptance**.

An initial far-side reference check exposed the effect of unlimited depth override.
Point and label overrides are now bounded to 200 km: nearby notes retain their
always-on-top readability, while distant notes respect depth occlusion. This does
not claim that a defect was reproduced in the user's actual terrain preview.

Final browser run exits 0, with all three visible markers picked and 81/82/81 amber
pixels around their projected centers; hiding yields zero amber pixels at each.
The camera remains unchanged within tight floating-point tolerances. Far-side
markers are not picked through the reference mesh; screenshots were also inspected.
Playback disables the layer without automatic resumption. No page/render errors,
failed local assets or external requests were recorded. Owned-browser cleanup was
graceful (1.952 seconds), with no forced termination. Images are ignored local
artifacts under `qa-shots/astroeye-note-markers/` (shown, hidden and far-side).

All **460 platform tests pass** (36.330 seconds), including assertions for the
bounded depth setting. The production build passes (18.38 seconds), retaining
node:fs browser-externalization and large-chunk warnings. The fixture's continuous
20-FPS rendering is test-only; application render scheduling is unchanged.

Actual terrain/buildings, overlapping notes, embedded-host interaction and GPU
performance remain unverified. No release gate closes, no user data changes and
nothing is published. Next: actual-host note-marker interaction/overlap acceptance
and remaining release checks; live V3 remains separately approval-gated.

## Checkpoint 77 — exact-coordinate overlap labels (September 15)

Notes with identical numeric latitude/longitude now share one nearby label showing
their count and captured UTC time (or explicitly labeled First/Last times). This
summarizes a range, not every intermediate capture. The lowest sorted note ID owns
the label; other note entities retain their points and pick ownership but have no
visible label. Deleting the representative promotes the next ID on refresh.
Individual records, captured positions and the existing shown-note count remain
unchanged. No fuzzy clustering, location jitter, source details or private note
text is added. Nearby distinct coordinates can still have overlapping labels.

Checkpoint 142 supersedes the original label placement: labels are top-anchored
12 pixels below their points, separating note times from selected-event labels
above the same location. Exact-coordinate grouping is unchanged. Originally,
labels were bottom-anchored 12 pixels above their points to separate the three-line
summary from its dot. Event notes help explains the grouping and directs
users to saved notes for individual details. Existing opt-in, playback, import,
privacy and cleanup behavior is preserved.

All **461 platform tests pass** (35.373 seconds), including deterministic grouping,
input preservation, representative deletion, single-note restoration, distinct
nearby coordinates, 100 coincident notes and label anchoring. The updated offline
WebGL check passes with exit 0 and graceful 1.735-second cleanup under a 60-second
whole-run watchdog. It verifies three coincident notes have one exact count/range
label, and retains the visible/hidden, camera, occlusion and playback checks. The
final `qa-shots/astroeye-note-markers/coincident.png` was visually inspected; an
earlier screenshot prompted the bottom-anchor correction. External requests: zero.

Production build passes (17.07 seconds), retaining existing node:fs externalization
and large-chunk warnings. The initial sandboxed build failed on parent-directory
access while loading Vite configuration; the permission-approved retry succeeded.

Embedded-preview inspection was attempted but failed before connection with the
tool's kernel-assets error (os error 3). No user tab or database was accessed. The
reference-mesh fixture still does not verify actual terrain, buildings, nearby
screen-space collisions or embedded-host usability. No release gate closes.

### Remaining manual preview check

Use existing notes if available; do not create or delete personal records just to
run this check. Save any unsaved editor draft before refreshing the preview.

1. Open **AstroEye → Event notes → Show note markers**, then close AstroEye.
2. At a known note location, check the amber dot and readable UTC label. If existing
   notes share exact coordinates, check the count and First/Last summary against
   their individual saved-note details. Otherwise mark that case untested.
3. Zoom/rotate and check visibility against the actual map/terrain. Nearby distinct
   labels can still collide; record that limitation rather than assuming clustering.
4. Hide markers and verify they disappear without moving the camera. A read-only
   marker click should not open a note or change the selected chart.

Record browser, map source, observation and remaining limitation before accepting
any host criterion. This procedure is a handoff, not a completed manual test.
