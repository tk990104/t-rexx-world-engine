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
