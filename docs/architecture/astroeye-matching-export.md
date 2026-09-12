# Matching-event export

Under Saved events, apply search/date/sort choices, then choose **Export matching events (count)**. The download is `t-rexx-matching-events.json`. It includes every matching saved event across all list pages and beyond the 100-marker limit, in applied UTC start order. Unsubmitted form edits do not change the export scope. The count describes the cached roster; the export rechecks current durable records and refuses an empty result.

The file includes event details, provider provenance, venue coordinates and all stored charts linked to matching event IDs. Review it before sharing. Research workspaces are deliberately omitted, even if they reference matching events, because they may also contain unrelated information. Session callouts, camera state, filters, transient chart previews and unsaved shared views are not exported. No chart is recalculated and no event, selection, clock or camera is changed.

**Export all** remains a full backup using `t-rexx-world-records.json`, including all stored events, charts and research workspaces. Both exports retain the existing schema-version-1 import format. Matching exports contain an empty `workspaces` array and can be imported through the existing Import control.

`worldRecordStore` now reads all three stores within one readonly IndexedDB transaction for a coherent export snapshot. `workspaceController.serializeMatchingRecords` captures normalized filters before awaiting storage. The pure `matchingEventRecords` helper selects matching events and their linked charts using existing filter/sort rules. The UI initiates a local download only on an explicit click; this feature adds no upload, provider request, dependency or API key.

## Bounded verification

27 targeted export, workspace-controller and record-store tests passed, including 120 matching events, exclusion of unrelated charts/workspaces, inclusive venue-local dates, empty-result refusal, import round-trip, no record/selection mutations and filters frozen across delayed reads. The production build passed with existing bundle-size and browser-externalization warnings.

The DOM-only browser check passed within its 60-second watchdog. It verified 121-event export from a non-first page, ignoring unapplied input, distinct filenames, research-workspace exclusion and preservation of full-backup export, alongside existing filter/paging/framing/mobile checks. Downloads are captured by an injected sink in this check; native browser download behavior and the full 3D globe are not newly certified.
