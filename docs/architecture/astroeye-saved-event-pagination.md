# Saved-event sorting and pages

The saved-event filter form now includes **Sort by event start (UTC)** with newest-first and oldest-first choices. Choose **Apply filters** to apply the order to both the list and the cyan-marker selection. Equal UTC starts use an ascending record-ID tie break. Sorting compares actual UTC instants, while the date filters continue to use each venue's local calendar date.

The list renders at most 25 event buttons per page. **Previous page / Next page** and a visible range/page count appear only when more than one page is needed. A page change focuses the first event button; reaching a boundary disables the corresponding control. Applying or clearing filters resets to page one. If saved records shrink during a normal refresh, the current page is clamped to the available range rather than presenting an empty obsolete page.

Paging does not change map markers. The map uses up to 100 additional matching events in the applied sort order, independent of the current list page; its selected-event exclusion and framing rules are unchanged. Switching sort can change which 100 additional events appear. The selected chart and purple marker are not changed by either operation.

Both ordering and page selection are local UI state, not record mutations or shared-link/Director data. Clear filters restores newest-first ordering. Export still includes all records. Filtering, sorting and paging use cached records without new storage/provider requests or camera commands. This bounds rendered list rows; it is client-side pagination, not database pagination, and normal workspace refreshes still load the event roster.

## Bounded verification

22 targeted filter, page, saved-layer and framing tests passed, including UTC ordering, deterministic ties, immutability, page boundaries/empty/shrink cases and sort-before-marker-cap behavior. The production build passed with the existing size/externalization warnings.

The existing 60-second-limited DOM-only UI check passed with 61 synthetic records: first/last/previous pages, focus, list/map order parity, apply/clear resets, collection shrink, unchanged map during paging, no added reads/flights on sorting or paging, mobile width and no page errors. The mobile pager screenshot was inspected. No full 3D globe or tour regression was started for this checkpoint.
