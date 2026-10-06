# AstroEye performance and regression checkpoint

October 6, 2026 — checkpoint 145. **U3 remains open.** This checkpoint adds a
measurable local budget and a production-app 100-event result, while explicitly
recording the missing 1,000-event production run instead of treating synthetic
or offline measurements as a device guarantee.

## Budget and scope

The bounded acceptance budget is a median of **500 ms or less** and no observed
operation above **2,000 ms**. It applies to the measured action interval: the
workspace operation promise, one animation frame and a forced workspace-root
layout. It is not a GPU frame-rate, screen-paint, physical-input or mobile-device
guarantee. The budget helper requires at least three finite nonnegative samples,
retains every raw sample and rejects either a high median or high maximum.

The production runner gained four isolated modes:

- `performance-100` and `performance-1000` seed the real app's IndexedDB through
  the app import path, render charts in the mounted AstroEye workspace, measure
  list/filter/selection/time-preview paths, toggle saved-event and note markers,
  and verify 25-row/100-marker caps, exact records, camera, viewer-clock/layers,
  and a synthetic unrelated module entity/state.
- `performance-idle` and `performance-active` are reserved for a visible-map
  ten-second observation. They check actual terrain readiness, event-sky counters,
  chart mutation, camera movement and record/shared-state preservation. They do
  not turn the existing passive render observer into an FPS benchmark.

All modes use fresh synthetic profiles. Provider requests, microphone and live
voice traffic are blocked. No user profile, records or key values are read.

## Passing evidence

Final production build fingerprint remains
`5f55375f0bc05ec2e7976154a169372902151a036a4f743551e90a8b0779eca1`.
Windows standalone Chromium `145.0.7632.77`, 1280×900, synthetic records.

`performance-100` passed and closed its owned browser gracefully. Results in
milliseconds (five samples for ordinary actions; three for marker toggles):

| Operation | Median | Maximum |
| --- | ---: | ---: |
| Open/list 100 saved events | 75.7 | 1,740.0 |
| Filter list | 58.7 | 64.7 |
| Same cached chart selection | 151.7 | 176.1 |
| +15-minute time preview | 47.7 | 50.5 |
| 100 saved-event markers | 333.5 | 636.6 |
| 100 note markers | 288.6 | 307.8 |
| Varied venue/house chart-cache misses | 90.4–176.7 | 97.5–180.5 |

All values satisfy the provisional local budget. Records, camera, other layer
state, viewer-clock policy, unrelated entity/module state and the 25/100 caps
were preserved. The full production workflow still passes separately.

Offline `qa-astroeye-performance.mjs` also passes on Windows x64 Node 24.21.0:
the 25/100/1,000 CPU/filter/sort/marker cases and 1900/2026/2100 chart/preview
cases complete in 4.155 s. This is in-memory storage and no browser rendering;
its own report remains observational only. The 50 focused render-governor,
celestial-ring, WorldClock, saved-marker, note-marker, presenter and policy tests
pass in 114.328 s. Existing platform/build evidence is not relabeled as a new
full-suite or hosted-CI run.

## Open boundary

The `performance-1000` production-app run was attempted but could not start in
the current restricted session: standalone Chromium launch is unavailable without
the elevated runner, and the elevation review is blocked by the account usage
limit. This is an environment limitation, not a passing or failing application
performance result. The actual 1,000-event mounted workspace, marker toggles,
varied cache misses, idle/active ten-second render observation and a supported
device/collection profile therefore remain open. Do not accept U3 from this
checkpoint, and do not claim the 1,000-event CPU baseline as browser evidence.

The runnable commands are:

```text
node scripts/qa-astroeye-full-app-workflow.mjs --phase=performance-1000 --session=session-...
node scripts/qa-astroeye-full-app-workflow.mjs --phase=performance-idle --session=session-...
node scripts/qa-astroeye-full-app-workflow.mjs --phase=performance-active --session=session-...
```

Run `workflow` first when a new production build is made so the session manifest
matches the build fingerprint. Keep each browser run sequential and within the
existing 60-second watchdog. No deployment, push, or release-scope change was
made.
