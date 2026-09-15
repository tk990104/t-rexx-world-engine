# Persistent research annotations — R1/R2/R3 candidate, checkpoint 73

Status: **storage service and staged editor implemented and tested; not mounted in the app**.
The editor is exercised only by an isolated synthetic-data harness. No main-app
controls, map display or new sharing behavior are added by this checkpoint.
R1 review, R2 workflow and R3 recovery/privacy acceptance remain
open. Live V3 testing remains separately approval-gated; it is not waived while
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

The editor is still unmounted. Next is actual workspace navigation/selection and
Director-safe integration, including import-review privacy wording, styling and
browser validation. No full-app build, embedded-host acceptance, live voice, release
gate closure, user-record access or publication is claimed. Map display remains separate.
