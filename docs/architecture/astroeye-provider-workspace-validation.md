# Provider-to-form validation

## Checkpoint 83 — September 15, 2026

The real workspace, controller, time conversion and IndexedDB services pass a
bounded synthetic provider-review workflow. No application code changed.

Run against the local development server:

```sh
node scripts/qa-astroeye-provider-workspace.mjs --node-assets
```

The explicit flag acknowledges the test-only localhost asset relay introduced in
checkpoint 82. It forwards unchanged local module bodies, never cookies or
credentials, refuses redirects and bounds each fetch to five seconds. The sports
endpoint is intercepted with synthetic schedule/venue responses; all other APIs
and external origins are blocked. A fresh browser context owns the synthetic
database. The camera presentation seam is mocked; the user's browser is untouched.

Verified through the mounted form:

- Loading a provider result does not save a record or infer an IANA zone from a hint.
- Choosing America/New_York preserves the provider's 2026-11-01 06:30 UTC instant,
  the second occurrence of local 01:30 during the repeated hour.
- Review is required before saving, and editing a field clears that approval.
- An explicit reviewed save persists one event/chart with provider provenance and
  user-reviewed coordinates, requesting one camera presentation.
- A synthetic venue-lookup failure clears coordinates and prevents incomplete saves.
- New/manual entry removes provider review requirements and saves a manual-source
  event without changing the original provider event or private note/notebook bytes.

Final browser run: exit 0, all assertions pass, no unexpected API/external requests
or page errors, cleanup graceful in 1.565 seconds, no forced termination. Cleanup
began at 17.700 seconds. Whole-run watchdog remains 60 seconds; mount limit remains
20 seconds. Two preceding runs failed: the manual fallback fixture omitted required
home/away teams (first a timeout, then a direct validity assertion); each also
required owned-process cleanup fallback. Those are failures, not passing evidence.
The fixture was corrected before the final run; deadlines were not increased.

Focused regression command: 46 tests passed, zero failures, 4.160 seconds:

```sh
node --test scripts/qa-owned-browser-cleanup.test.mjs src/modules/astroeye/sportsSchedule.test.mjs src/modules/astroeye/workspaceController.test.mjs src/modules/astroeye/draftTimeSummary.test.mjs
```

This is partial U1 evidence, not live-provider, normal asset-delivery, full app,
actual globe or embedded-host acceptance. Director handoff/playback/stop and private
research exclusion remain next. No release gate is newly closed: five accepted,
ten open. No new full-suite/build claim, user-data access or publication.
