# Venue details dismissal during pending work

September 19, 2026, checkpoint 108, from `71bea4b`.

Venue details previously routed Close and Escape through the same busy guard as
callout creation. A pending callout therefore prevented dismissal. A separate
close-in-progress guard now permits dismissal during pending work while retaining
the host interaction policy, preventing duplicate close requests, and allowing
retry after a close failure. Other actions remain serialized. Closing does not
cancel a callout the user already requested. Delayed completion does not reopen
the card or focus it; disposal prevents late rendering/status updates.

The card also uses the shared Escape guard: composing and already-handled events
are left alone; ordinary Escape is consumed before requesting dismissal.

## Verification

- All 23 focused keyboard/focus tests pass (4.108 seconds), including the venue
  wiring contract; syntax and diff-whitespace checks pass.
- `scripts/qa-astroeye-venue-dismissal.mjs` mounts the production venue panel in a
  disposable browser with synthetic in-memory callbacks and no app bootstrap,
  storage or provider requests. Close-button and Escape checks pass during both
  successful and failing delayed callouts; focus stays on the launcher. It also
  verifies blocked host policy, close-error retry, duplicate close suppression,
  serialization of other actions, composition/prevented-event simulations and
  disposal during delayed completion. No page errors or external requests.
- All browser functional assertions pass, but browser shutdown exceeds the
  unchanged 10-second cleanup cap. Page closure completes; forced cleanup is
  requested for the owned test browser, and the harness exits 1. This is not a
  clean browser-lifecycle pass. Native IME, screen-reader speech, actual map
  annotation creation and full app/Director integration are not certified here.
- Production build passes (261 modules, 1m 26s), with existing node:fs
  externalization and chunk-size warnings. Platform/full-repository/allocation
  suites were not rerun for this bounded change; checkpoint 107's caveats remain.

For reproduction, run the dedicated test server, set `QA_BASE_URL` to its loopback
origin, then run `node scripts/qa-astroeye-venue-dismissal.mjs`. The harness has a
60-second overall cap and reports the current phase on timeout. It never attaches
to the user's browser profile. The separate port-5175 server used for this run was
stopped; the user's preview and saved research were untouched. Nothing published.
Five gates remain accepted and ten open; U2 remains open.
