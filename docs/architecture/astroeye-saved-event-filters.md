# Saved-event search and dates

Under **Saved events**, enter a search and/or **From date / Through date**, then choose **Apply filters** (Enter also submits). **Clear filters** restores the complete list. Both date endpoints are inclusive and use each event's venue-local calendar date, not UTC or the viewer's time zone.

Search is a case-insensitive literal substring across event title, sport, competition, home/away participants and venue name. Whitespace is normalized; HTML and regular-expression-looking text have no special meaning. Search is limited to 100 characters. Calendar validation rejects impossible dates and reversed ranges before changing the applied list or map filter. Empty dates give open-ended ranges.

The list and cyan map markers use the same pure `savedEventFilters.js` function. Map filtering happens before the 100-additional-marker cap, so a matching event outside the original first 100 can appear. Counts distinguish matched records from additional rendered markers. The selected purple marker and chart remain unchanged, even when that event falls outside the filter. No-match messages explain how to recover.

Filters are session-only UI state. They survive panel close/reopen, saved-map hide/show and Director suspension within that page, but are not saved in record storage, shared URLs or Director projects. Reload resets them. Export retains its existing all-record behavior; this is not a filtered export feature.

Applying filters uses cached record lists: no storage read/write, chart calculation, camera command or provider call. Normal save/import/delete refreshes continue and use the latest applied filters. Workspace list refreshes now discard older responses; layer refreshes retain their existing generation guard. No new dependency or API key is needed.

## Bounded verification

- 12 focused filter/layer tests passed, including venue-local versus UTC date boundaries, inclusive/open dates, literal search, invalid-range rollback, cap ordering, selected-marker preservation, pending reads, suspension and reset behavior.
- Production build passed (existing bundle-size and browser-externalization warnings remain).
- `node scripts/qa-astroeye-filters.mjs` passed list/map parity, invalid-range rollback, no matches/clear, keyboard submission, no additional record reads or forbidden mutations, mobile width and no page errors. The mobile screenshot was inspected.

The UI check mounts the real workspace and saved-event layer against synthetic in-memory records and a non-rendering viewer stub in a fresh browser. It has a 60-second overall watchdog and does not initialize the 3D globe or run tours. It is a targeted UI/integration check, not a new full-globe or complete inherited-suite certification.
