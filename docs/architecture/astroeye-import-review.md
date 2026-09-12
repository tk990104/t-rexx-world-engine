# Review before importing

**Saved events → Import** opens a read-only review before any merge. Select a schema-version-1 world-record JSON file up to 10 MiB. The panel shows the filename as plain text and counts records to add, overwrite or skip as unchanged, separately for events, charts and research workspaces. Records are compared after normalization: nested object-key order is ignored, but array order and value changes count as differences. This is a data comparison, not a judgment about which version is more accurate.

**Confirm merge** applies only new and changed records; identical records are skipped. When changes would overwrite existing records, the user must check **I approve overwriting the changed saved records** before confirmation is enabled. The controller also requires explicit boolean approval, not merely the UI checkbox state. Approval resets on each review. If all records already match, confirmation stays disabled and nothing is written or announced as an import.

**Cancel** leaves stored records untouched. Unrelated stored records remain. Closing the panel, pressing Escape, choosing another file or destroying the workspace discards an unconfirmed review. Closing during an asynchronous file read cannot restore a canceled review. Once confirmation starts the atomic transaction, closing is not an undo operation.

Invalid JSON, unsupported schemas, duplicate IDs, invalid records, charts referencing unknown events, empty files and oversized files are rejected before confirmation. Charts may reference an event already in local storage when merging. The review validates structure and relationships, not the truth or scientific accuracy of imported contents; only import trusted files. The current displayed chart stays unchanged, so reopen a saved event to see imported data. No camera or clock action is added.

## Boundaries

- `worldRecordStore.previewImportRecords` normalizes input, reads a coherent readonly snapshot, validates chart relationships and computes add/overwrite/unchanged counts. Only new and changed records enter the prepared payload. Confirmation result counts describe records actually written, not total file contents.
- `recordImportReview.js` privately retains the validated payload and snapshot. It returns only a copied summary and uses generation guards to reject stale responses. A confirmed write attempt is single-use; a transaction failure requires reviewing again. Missing overwrite approval is rejected before consuming the review, allowing the user to acknowledge and continue.
- The confirmed merge compares the reviewed snapshot with the current snapshot **inside the same readwrite transaction** before writing anything. Any intervening event, chart or workspace change rejects the entire import and asks for a new review. There is no force-overwrite shortcut in this UI.
- The controller emits the existing records-imported notification only after success. Existing list/map refresh paths remain in use; full and matching exports retain their formats.
- The lower-level programmatic import API retains merge/replace support for existing callers. The workspace exposes only the reviewed merge flow. No uploads, new dependencies, migrations or API keys are involved.

The preview and comparison use complete in-memory record snapshots, not database pagination. The 10 MiB limit bounds selected input files, not the size of the existing local database.

## Bounded verification

37 targeted store, controller, import-review and matching-export tests passed. Coverage includes no writes during review, immutable private payload, add/overwrite/unchanged counts, strict overwrite approval, identical-only refusal, reordered nested object keys, array/value changes, single confirmation, cancellation, delayed-response invalidation, stale event/chart/workspace edits, invalid imports, existing-event chart references and import/export round-trip.

The production build passed with the existing browser-externalization and bundle-size warnings. Two DOM-only browser checks passed, each with a 60-second watchdog. The import check uses the real controller and isolated IndexedDB with synthetic records; it verifies review/confirm/cancel, overwrite checkbox toggling and reset, identical-only refusal, stale refusal, invalid/oversized files, plain-text filename rendering, mobile width, focus, Escape and close during a delayed file read. The existing filter/paging/framing/export check also passed. Neither initializes the full 3D globe or accesses the user's saved records.
