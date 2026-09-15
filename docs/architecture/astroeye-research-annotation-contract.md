# Persistent research annotations — R1 foundation, checkpoint 71

Status: **storage service implemented and tested; not mounted in the app**.
No user-visible annotation controls, map display or new sharing behavior are added
by this checkpoint. R1 review, R2 workflow and R3 recovery/privacy acceptance remain
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
  conflict. There is no annotation-deletion undo in this first service.
- Source event deletion does not cascade into annotations. `sourceState` reports
  `source-missing`; same-ID restoration reports `source-present`. This means the
  reference resolves, not that all restored event contents are identical. Captured
  time, coordinates and note never change during this lifecycle.
- Quota/transaction errors propagate without mutating the caller's draft/baseline.
  The user must retain a failed draft before any later refresh in the eventual UI.

The service receives only the record store. It cannot change the camera, clock,
chart selection, shared annotation board or notebook. Existing session callouts
remain session-only and separate. It is not registered in voice catalogs.

## Verification and remaining work

**25 focused tests pass** (18.754 seconds), no failures, skips or TODOs: six new
annotation tests plus existing record-store, notebook and event-callout tests.
They use fake IndexedDB with synthetic records, not the user's browser database.
Coverage includes exact text/snapshot copies, empty read behavior, stale/concurrent
writes, scoped deletion, source deletion/undo, preserved notebook/event bytes,
limits, malformed/future data and injected write failure. Syntax/diff checks pass.
No production build or full-app suite was rerun: the new service is not imported
by the application entry point, so current runtime behavior is unchanged.

Next: explicit save/reopen/edit/delete UI, frozen snapshot labels, missing-source
messages and opt-in bounded map display. Before exposing the workflow, extend
recovery/privacy tests for reviewed import, conflicts, unsupported records and
exclusion from matching exports, reports, links and tours. Generic workspace backup
plumbing already exists, but it is not R3 acceptance for this new record contract.
