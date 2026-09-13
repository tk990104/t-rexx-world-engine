# Local Research notebook

Choose **Research notes** in AstroEye's sticky shortcut bar. The notebook is one free-text workspace across events, not an event-attached annotation or a completed Research Mode module. No chart, event title or location is copied into it automatically. It accepts up to 10,000 JavaScript string units of plain text (some Unicode characters use two).

## User workflow

Notes are loaded only when the notebook is first opened. **Save notes** explicitly writes the current draft; editing alone does not save. Unsaved edits survive closing/reopening AstroEye within the same page, but not page reload, app restart or destruction of the panel. A visible count and unsaved indicator distinguish drafts. There is no autosave or unload prompt.

**Reload saved notes** asks for confirmation before discarding a changed draft. Save failures keep the draft editable. If saved notes changed in another tab or through import, saving refuses the overwrite and asks the user to copy their draft somewhere safe before reloading. Saving an empty draft deliberately replaces the note text with an empty string; it does not delete event records. Editing is disabled during a pending read/write. An already-requested save may finish after closing or destroying the panel; late results cannot redraw a destroyed panel.

## Data and privacy boundaries

### Append the current chart reference

With a valid event chart displayed and the notebook loaded, **Append current chart reference** adds a static text block at the end of the current draft. It includes event title, exact displayed UTC chart time, engine/version, zodiac, reference frame and house system. An unsaved time-explorer offset is preserved; the pinned comparison chart is not used. The adjacent Current chart label identifies what would be appended.

This action does not save, select, calculate, move the camera or overwrite existing draft text. It moves editor focus/caret to the end so observations can follow the reference. The block is never updated automatically when chart selection/time changes. Save notes explicitly to keep it. Repeated clicks deliberately append another block; this is not a structured linked-note database.

Only the named metadata fields are copied: no venue-coordinate fields, IDs, collection records or calculated longitude values. Titles may contain user-entered private details, so review before saving/exporting. Free-text fields are quoted with embedded line breaks escaped. References are not complete reproducible chart backups or clickable links. Missing/invalid chart metadata disables append; clearing the selected chart clears the reference source without changing the draft. Appending is disabled while loading/saving, and the complete result must fit the notebook's limit or nothing is appended.

The notebook uses the existing IndexedDB `workspaces` store with ID `astroeye-research-notebook-v1`, kind `astroeye-research-notebook` and schema version 1. No database migration, network request, provider, credential, cloud sync or new dependency is added. This is browser-local plaintext storage, not encrypted or account-backed storage. Browser data may be cleared; use a full backup for recovery.

**Export all** includes the saved notebook in its existing `workspaces` array. Existing reviewed import can add/overwrite it under the same confirmation and stale-review rules. Matching-event exports exclude it, as do comparison reports, shared views and Director project snapshots. Unsaved text is never included in record backups. Deleting an event does not remove the global notebook. Review full backups before sharing.

`createResearchNotebook` exposes only notebook load/save capabilities to its panel. `saveWorkspaceIfUnchanged` compares the entire expected workspace record against the current one inside a single IndexedDB read/write transaction before writing. A null baseline means the record must still be absent. Concurrent first saves therefore cannot overwrite each other. Extra supported-record metadata is preserved; unsupported versions/types refuse notebook editing without altering the original record.

## Verification

Chart-reference checkpoint: 40 targeted reference/notebook/storage/controller tests passed. The isolated notebook browser check verifies exact preview time, preserving existing text, no writes or selection change from append, no automatic update of inserted text, focus and all-or-nothing overflow refusal. Existing notebook checks also pass. Native user data and full-globe rendering are not used.

The integrated workspace browser regression and production build also passed for the chart-reference checkpoint. Both browser checks kept their 60-second watchdogs; build warnings remain the existing externalization/bundle-size warnings.

The existing integrated workspace/import browser regression also passed under its 60-second watchdog. Production build passed with the existing node:fs externalization and bundle-size warnings. This does not certify the full inherited release suite or native file-saving behavior.

36 targeted notebook/storage/controller tests passed, including exact text persistence, full-backup import round-trip, stale/concurrent writes, maximum length, unsupported formats, blank saves and existing deletion/selection safety. The isolated notebook browser check passed with synthetic records under a 60-second watchdog: lazy reads, explicit saves, draft preservation, literal HTML-like text, conflict protection, reload confirmation, matching-export exclusion, unchanged events/charts/selection and 390/1280 px layout. Native user data and the full globe were not used.
