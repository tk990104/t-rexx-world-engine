# Uncached varied-venue workspace checks

## Checkpoint 88 — September 15, 2026

Added six synthetic venue/time cases, each checked with Whole Sign and Equal
houses. Inputs reuse the existing regression pack, not its legacy numerical
expectations. Cases cover both New York fall-fold occurrences, Sydney summer,
Kathmandu's quarter-hour offset and Longyearbyen polar day/night. Current-model
fixture tests are internal consistency checks, not independent accuracy evidence.

```sh
node scripts/qa-astroeye-provider-workspace.mjs --node-assets --collections --collection-size=100 --uncached
```

The optional mode replaces six synthetic collection entries while retaining the
requested total and search counts. The six events have no saved charts. Each is
selected through the real mounted workspace with navigate:false and
persistChart:false. The house-system form value changes for each method. One
warmup and three measured cache-miss selections run per case/method, followed by
a check that no chart was stored. This means **chart-cache miss in a warmed app**,
not cold browser startup, empty ephemeris caches or the default save-new-chart flow.

The existing cached/list/preview baseline still has one warmup and five samples;
do not confuse those counts with the three-sample uncached observations. Timing
ends after one animation frame and forced workspace-root layout, not actual screen
presentation. Same isolated native IndexedDB, mocked camera, 800x600 headless Chrome
145.0.7632.77 and explicit localhost asset relay as checkpoints 86/87. No live
services or user browser/data are used.

## Results and failed attempt

The first 1,000-event run is **incomplete**: module startup plus synthetic seeding
consumed about 41 seconds. The 60-second watchdog fired during the polar-night
Whole Sign phase, exit 1, before final verification/report and graceful cleanup.
The watchdog attempted termination of its owned browser process. Partial progress
is not accepted as a complete 1,000-event result; normal cleanup was not established.
No deadline was increased and no further 1,000-event retry was made.

One smaller 100-event run passed all twelve combinations, exit 0. Cleanup began
at 18.263 seconds and completed gracefully in 9.706 seconds, no forced termination.
Zero provider/external requests, page errors or relay failures. Exact event/chart/
private-workspace backup bytes were preserved, including detached-list mutation
and native database-connection reopen checks. No calculated case charts persisted.

100-event collection, observed median milliseconds (three samples per cell):

| Case | Whole Sign | Equal |
|---|---:|---:|
| New York, first 01:30 | 130.7 | 85.9 |
| New York, second 01:30 | 96.6 | 113.9 |
| Sydney summer | 59.8 | 119.0 |
| Kathmandu | 189.4 | 61.2 |
| Longyearbyen polar day | 118.7 | 87.9 |
| Longyearbyen polar night | 202.8 | 155.4 |

The largest uncached measured sample was 264.6 ms (polar-night Whole Sign).
Small samples, fixed order and uncontrolled scheduling/JIT/GC preclude speed
comparisons between venues or house methods, support guarantees or a meaningful
production p95. Raw samples are emitted in the command report.

All cases assert selected identity, canonical UTC, model 4, requested house method,
ten chart positions and mounted SVG. The two repeated hours retain 05:30 and
06:30 UTC respectively. Polar cases retain a visible angle caution and unavailable
planetary-hour calculation state; ordinary cases retain exact hour state. This
does not certify high-latitude interpretation, real-globe rendering or every UI
announcement. Source records and private research remain unchanged throughout.

## Verification and next boundary

12 focused fixture/statistics/owned-cleanup tests pass (2.413 seconds). An initial
fixture test failed because it attempted to mutate intentionally frozen normalized
events; it now asserts that immutability and independently returned event objects.
Syntax checks pass. Application runtime remains 990f4f0; no new full-platform/build
run is claimed for these test-only changes. Nothing published.

Five release gates remain accepted and ten open. The 1,000-event varied-uncached
workflow, actual embedded host, GPU/terrain behavior and U3 support/timing budgets
remain unaccepted. Next: split larger-collection case coverage into bounded batches
instead of lengthening the watchdog; the per-frame/shared-state U3 audit also remains.
