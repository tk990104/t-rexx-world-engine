# Passive host render check — checkpoint 91

September 15, 2026. Status: implemented and unit/build verified; **actual-host UI
and observation remain pending**. Browser inventory failed twice before tab access
with `Unable to load browser request-header policy`. No policy bypass, alternate
attachment to the user's browser, native automation workaround or retry loop was
attempted. This is a tool-connection blocker, not a measured application failure.

## Run in the existing app

1. Open AstroEye and expand **10-second render check**, immediately below the
   quick-navigation buttons. No selected event or new saved record is required.
   If the control is missing, safely finish unsaved edits before refreshing.
2. Leave layers, camera and event settings as they are. Click **Start 10-second
   check**, then keep the tab visible without clicking, typing or scrolling.
3. Once complete, select and copy the local JSON report here for review. Nothing
   is sent automatically. An incomplete result can also be shared; it is not a pass.

Do not change any layers or create/delete records just for this first baseline.
The diagnostic does not make the main app offline: already-active feeds continue
their normal work. Optional later runs can investigate a specific configuration
after reviewing this initial report.

## Measurement and privacy boundary

`renderCheck.js` attaches one owned Cesium post-render listener only after Start,
counts existing callbacks and reads minimal counters at the start and end. It
does not request renders, add a continuous-render hold, run an animation-frame
loop, calculate charts, read storage, change clocks/settings or make requests.
The public ring counter API contains no event time, direction vectors or geometry.

The `trexx-render-check-v1` report allowlists elapsed milliseconds, frame count,
governor mode, continuous-hold count, event-sky-enabled state and ephemeris update
counts/delta. It contains no event titles, chart times, coordinates, holder names,
URLs, user-agent identity, records or credentials. No clipboard or upload action
is automatic; report text exists only in the local panel until reload/replacement.

Completion is scheduled for ten seconds. Hidden tabs, pointer/key/wheel input,
Cancel and page teardown remove owned observers and cancel the timer. A timer
outside the 10–15-second window is explicitly incomplete, not a successful timed
sample. A blocked browser thread can delay any JavaScript timer, so this is not
a real-time execution guarantee. Counter failures also yield incomplete results.
Repeated starts are refused while active; a finished/cancelled run can be retried.

Few or zero frames may be healthy idle behavior, not a rendering failure. This
counts post-render callbacks, not GPU duration, screen presentations, maximum FPS,
chart-calculation latency or user-perceived responsiveness. Endpoint counters do
not establish that configuration was constant throughout; normal background work
continues. No supported-device, collection-size or performance budget is accepted.

## Verification

22 focused observer/ring/governor tests pass (4.353 seconds), including dormant
startup, only externally supplied frame counting, two counter reads, privacy
allowlisting, cancellation/hidden/input/disposal cleanup, duplicate starts,
counter reset/failure and delayed timers. All 480 platform tests pass (20.165
seconds). Production build passes with 254 modules in 11.10 seconds; existing
browser-externalized `node:fs` and oversized-chunk warnings remain.

No new actual-browser run, UI-layout observation, full-repository test suite or
host timing result is claimed. The panel is ready for the user-run handoff above.
Five release gates remain accepted, ten open; U3 and actual-host acceptance remain
pending. No saved user records were accessed or changed; nothing was published.

## Checkpoint 92 — Embedded host observation and readable results

September 15 local / September 16 UTC, 2026. The earlier browser-connection block
is no longer present. After the preceding preview-server restart, the existing
embedded tab was accessed through its normal browser interface, without any policy
bypass. AstroEye's disclosure, Start button and completed report were verified.

Two actual-host observations (before and after the summary-only change) completed:

| Sample | Elapsed ms | Scene renders | Mode at both endpoints | Continuous holds | Event sky | Ephemeris delta |
| --- | ---: | ---: | --- | ---: | --- | ---: |
| Initial | 10006 | 0 | idle | 0 | off | 0 |
| Readable-result verification | 10007 | 0 | idle | 0 | off | 0 |

These samples are consistent with idle rendering, not proof of GPU efficiency,
maximum FPS, active-scene responsiveness, chart latency or supported-device budgets.
No event was selected for these checks. Existing camera/layer settings were left
alone. Normal feeds continued, and opening AstroEye displayed the existing saved
list; no records were created, edited, deleted or exported. No private event details,
coordinates or browser identifiers are copied into this evidence table.

`renderCheckSummary.js` now formats the local report into plain-English status text.
It describes observed counts, unavailable/reset counters, endpoint differences and
reason-specific retry advice. Identical endpoints are explicitly not evidence of
constant configuration throughout. It never adds an FPS estimate or release pass,
and unknown reasons/extra fields are not echoed. The panel uses `textContent` and
retains its readonly JSON report without automatic clipboard or network actions.

All 15 focused tests pass (6.630 seconds), including seven new summary tests.
All 487 platform tests pass (24.799 seconds). Production build passes with 255
modules in 8.05 seconds after the sandbox config-read failure and a normal approved
permission-enabled retry; existing node:fs externalization and chunk-size warnings
remain. The hot-reloaded embedded UI completed the second observation and displayed
matching human-readable and JSON values. No full-repository-suite, responsive-layout
or assistive-technology certification is claimed.

Five release gates remain accepted, ten open. Next: event-sky/active-scene host
observations and explicit U3 device, collection-size and timing-budget decisions.
No publication or release acceptance is implied.

## Checkpoint 93 — Event sky, preview and compact panel

September 15 local / September 16 UTC, 2026. Normal UI actions selected an existing
QA-labeled saved event, enabled event sky, and advanced the unsaved preview by
15 minutes. No Save, Delete, Export, microphone or sharing action was used. Event
selection and Show event sky intentionally moved the camera to venue/global views;
no claim of camera preservation is made for those navigation actions.

| Sample | Elapsed ms | Renders | Mode / holds at both endpoints | Sky | Ephemeris before / after |
| --- | ---: | ---: | --- | --- | --- |
| Selected event start | 10002 | 0 | idle / 0 | on | 1 / 1 |
| After +15-minute preview | 10004 | 0 | idle / 0 | on | 2 / 2 |

Both observations completed through the embedded UI. The explicit preview update
advanced the counter once between samples; neither observation saw further
ephemeris updates. These are settled event-sky samples, not active-motion samples,
per-frame stress tests or GPU traces. The zero-frame windows alone cannot prove
no per-frame calculation; retain the separate source/unit audit for that claim.
Normal background feeds continued. No private event details are copied here.

The actual narrow-host screenshot revealed that wrapped sticky shortcuts occupied
roughly half the compact panel height and obscured scrolling content. The compact
`.astroeye-quick-nav` now uses `position: static`; full-workspace sticky navigation
is unchanged. Hot-reloaded UI scrolling and screenshots show the report and Time
explorer reachable without the shortcut overlay. Background map panels still
crowd this narrow host; this is not broad responsive/accessibility acceptance.

After verification, Event start restored offset 0 and the original displayed chart
time. Leave event sky restored the prior Celestial-off preference and full chart
panel. The camera remains at the global view reached by the test; no unrelated
layers were deliberately toggled. No saved record was edited, created, deleted or
exported; no byte-for-byte user-database audit is claimed.

All 20 focused event-sky/observer/summary tests pass (5.358 seconds); all 487
platform tests pass (39.751 seconds). The permission-enabled production build
passes with 255 modules in 18.09 seconds, retaining the existing node:fs
externalization and large-chunk warnings. No new full-repository test-suite claim.
Five gates accepted, ten open. Next: narrow-host layout/accessibility review,
active-motion observations and explicit device/collection/timing budgets. Nothing
was published.
