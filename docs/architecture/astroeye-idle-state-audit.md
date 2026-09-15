# AstroEye idle work and shared-state audit

## Checkpoint 90 — September 15, 2026

This is a source audit plus focused executable regression evidence, not an
embedded-browser idle trace or GPU/frame-rate certification. No live services,
user records or preview profile were accessed. U3 remains open.

## Call-path findings

| Path | Trigger and state boundary |
|---|---|
| `workspaceController.js` / `timeExplorer.js` | Chart calculations occur on explicit save, cache-miss selection, shared restoration/copy or preview requests. No render-loop/timer subscription was found in these modules. |
| `astroeyeWorkspace.js` / `eventSky.js` | Chart rendering updates event-sky directions; it does not subscribe chart calculations to clock ticks. The adapter supplies a direction snapshot to the shared ring. |
| `celestialRing.js` | Its post-render callback draws from cached directions. `_updateEphemeris` returns immediately when an AstroEye snapshot exists. The ring's existing 60-second live refresh timer also returns while that snapshot is active. This is not a claim that all ring drawing costs zero. |
| `savedEventLayer.js` / `researchAnnotationLayer.js` | Reads/rebuilds are driven by enable, explicit refresh, relevant record/selection events and mode transitions, not each frame. Existing tests cover late-response invalidation, opt-in visibility and teardown. |
| `main.js` / `worldPresenter.js` | AstroEye receives the platform WorldClock, not Cesium's viewer clock. Read-only presentation updates its selected-event entity and requests a render; navigation is explicit. The saved-map observer watches body class transitions rather than frames. |

The platform WorldClock intentionally enters event/replay mode for a selection or
preview and the active module becomes AstroEye. That is expected shared state,
not isolation of the global clock from AstroEye. Other modules' namespaced payloads
are retained. The Cesium/live-feed clock is a separate boundary at this stage;
future modules must not assume all feeds already follow WorldClock.

## Fixed clock validation defect

Previously `WorldClock.setMode` assigned its mode before validating the fixed
timestamp. A rejected live-to-event request could leave mode `event` with a null
fixed time, whose snapshot displayed 1970. A finite but unrepresentable numeric
timestamp could also be committed before ISO serialization failed. A rejected
switch to an invalid live source could discard an existing valid frozen mode.

The clock now resolves and validates a representable timestamp and builds its
snapshot before committing either mode or fixed time. Invalid `setMode`, `setTime`
and restore inputs preserve prior state and emit no change notification. Successful
live transitions sample their source once. The generic clock has not been narrowed
to AstroEye's 1900–2100 release range; that remains chart-input policy. Exceptions
thrown by event-bus listeners after a valid commit are not rolled back by this fix.

## Executable evidence

- Four new clock tests failed on the original code, then passed after the fix.
  They cover live/event/replay transitions, malformed and out-of-Date-range times,
  restores, invalid live sources and successful frozen notification snapshots.
- The real ring method is called 120 times with advancing test timestamps. Spies
  confirm zero live Sun/Moon model calls under the event snapshot; only explicit
  chart replacement increments the direction-update count. These are synthetic
  method invocations, not 120 actual rendered frames or an elapsed idle period.
- Real controller selection/preview plus 120 snapshot reads cause no additional
  storage calls, presentations or clock-change events. Another module's state and
  exact serialized synthetic records remain unchanged.
- A presenter fixture throws if read-only presentation touches viewer clock or
  camera; replacement/clear retain the unrelated live-feed-owned entity.

The first combined focused run had two test-fixture failures: a Proxy could not
wrap frozen store methods, and normalized vectors differed at floating-point
roundoff. A detached wrapper and the existing vector tolerance corrected those
tests without changing their production paths.

Final verification: **42 focused tests pass (9.460 seconds); all 472 platform tests
pass (43.211 seconds)**. Production build passes, 252 modules, 28.86 seconds. It
retains warnings for browser-externalized `node:fs` in two data modules and chunks
above 1500 kB. No new full-repository suite or browser run is claimed this checkpoint.

Five release gates remain accepted and ten open. Next: actual-host idle/render
evidence and explicit supported-device, collection-size and timing-budget decisions.
This audit does not accept U3, A1/A2 accuracy or the remaining release gates, and
nothing has been published.
