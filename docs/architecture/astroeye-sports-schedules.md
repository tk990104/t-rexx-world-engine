# AstroEye NFL schedules

AstroEye now offers NFL discovery through TheSportsDB: upcoming games or a selected UTC date. Choose a result to load teams, event name, venue, and any parseable venue coordinates into the form. Enter the venue's IANA time zone (for example, `Australia/Melbourne`); AstroEye converts the provider UTC time to local date and time, including the correct occurrence of a repeated DST hour. Review the time and coordinates, check the review box, then save the chart and venue marker.

## Coverage and data quality

- The [documented free endpoint limits](https://www.thesportsdb.com/documentation) are one upcoming league event or three events for a date. The panel describes results as limited; an empty response does not prove no games exist. A date search uses UTC calendar dates.
- The first adapter supports NFL (`4391`). Other leagues can reuse the normalized schedule contract and server service later.
- Provider `dateEvent` and `strTime` are interpreted as UTC, following [the provider's guidance](https://www.thesportsdb.com/forum_topic.php?t=5871). Local fields are ignored because they can describe a different location. Provider UTC remains subject to user verification.
- Missing, invalid, placeholder-midnight, postponed, cancelled, suspended, or time-to-be-defined starts are left unavailable. The form requires a verified time entered by the user. Genuine midnight starts can also be entered manually.
- Venue `strMap` accepts an explicit decimal coordinate pair or degrees/minutes/seconds. Unknown formats and missing coordinates stay empty. Free-text zone hints are shown as hints and never silently converted into fixed-offset time zones.
- Each save creates a new event snapshot with the provider ID, source event ID, retrieval time, and user-reviewed coordinates. Refreshing the feed does not overwrite saved charts or other observations. Edits require checking the review box again. Saved provider references remain visible in the chart provenance and JSON exports.

## Architecture and operation

- `src/modules/astroeye/sportsSchedule.js`: source definition, normalization, coordinate parsing, UTC-to-local conversion, and same-origin client.
- `src/modules/astroeye/sportsSchedulePanel.js`: schedule discovery UI and review-form handoff, with cancellation on close/reset and stale-response protection.
- `server/sportsScheduleProxy.js`: a standalone service installed in development and preview by `vite.config.js`. Only fixed NFL schedule routes and numeric venue lookups are allowed.
- `workspaceController.js`: enforces provider review and retains normalized source provenance when saving.

The service caches successful results for 15 minutes, coalesces concurrent identical requests, bounds cache size to 128 entries, and limits upstream calls to 20/minute per process. It times out after 12 seconds and pauses new upstream work for a minute after HTTP 429. It never returns expired schedules as fresh data or forwards upstream errors containing key-bearing URLs. Ordinary app startup does not fetch schedules; users request them from AstroEye.

Optional `THESPORTSDB_API_KEY` stays on the server. With no key configured, the provider's documented development key `123` is used. The existing deployment runs Vite preview, which installs the same endpoint; static-only hosting needs an equivalent server endpoint.

## Provider terms

[TheSportsDB terms](https://www.thesportsdb.com/docs_terms_of_use.php) permit API data for development and require a paid subscription for app-store publication. API data are subject to provider and third-party rights, not the repository's MIT code license. No artwork, logos, or descriptions are imported in this implementation. The UI links to TheSportsDB and preserves source identity. No subscription was purchased or account created.

## Verification

`npm run test:platform` includes schedule/time-zone normalization, uncertain-time handling, provenance review, coordinate parsing, cache expiry, concurrent request coalescing, rate limiting, input rejection, and development/preview installation.

With the local server running, `node scripts/qa-astroeye-schedule.mjs` runs an isolated browser test using synthetic provider-shaped data. It verifies form loading, the second DST occurrence, invalidation of review after editing, saved provenance, responsive widths, and resetting to manual entry. Test records are confined to the temporary browser profile.

`node scripts/qa-astroeye-schedule.mjs --live` separately checks real schedule selection and venue loading without saving a record. It depends on the provider returning an upcoming game. Set `QA_BASE_URL` to check a preview deployment.
