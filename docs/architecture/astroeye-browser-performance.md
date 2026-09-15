# Mounted workspace / native-storage baseline

## Checkpoint 87 — Selection-stage profile and redundant-copy removal

Collection-mode test wrappers now time getEvent, listCharts, controller selection
and full-list refresh without adding instrumentation to production. The intervals
between controller completion and list-read start, and between list-read completion
and workspace-method completion, capture chart/status and list-update work. These
are coarse boundaries, not a CPU flame chart. Event/chart read spans are nested
inside the controller span; do not add them twice or sum independent medians.

The 1,000-event profile before the runtime edit used checkpoint 86 code. The
second run removes only the redundant deep copy from the generic list helper:
IndexedDB getAll already supplies a detached object graph. Fresh reads, transactions,
sorting, refresh calls, individual/indexed chart reads and schema remain unchanged.

Observed selection-stage median milliseconds, five measured iterations:

| Stage | Before edit | After edit |
|---|---:|---:|
| Controller selection (includes event/chart reads) | 34.5 | 14.7 |
| Chart/status update interval | 6.9 | 4.6 |
| Full saved-list read | 108.0 | 52.5 |
| List update interval | 6.0 | 4.3 |
| Animation-frame wait and forced layout | 16.5 | 14.4 |
| Whole cached selection | 183.3 | 89.8 |

Whole-selection maximum samples were 652.1 and 109.1 ms. These are separate,
instrumented local runs with uncontrolled scheduling/JIT/GC; unchanged stages and
seed-import times also varied substantially. **Do not attribute the entire timing
difference to this edit or claim a guaranteed speedup.** The directly verified
change is eliminating an extra full-collection copy while retaining fresh reads.

Both browser profiles passed and exited 0, with graceful cleanup in 3.968 seconds
(before) and 4.739 seconds (after), no force. Cleanup began at 24.799/10.739 seconds;
the 60-second watchdog is unchanged. The post-change run additionally recursively
mutates detached event/chart/private-workspace list results and verifies unchanged
native-storage backup bytes and connection reopen. No mutated values are written
back. No user browser, data, credentials, live providers or external feeds are used.

New unit tests verify deep isolation and independent snapshots across event/chart/
workspace lists, plus another connection's updates/inserts/deletes becoming visible
without modifying old snapshots. All 466 platform tests pass (39.523 seconds);
15 focused storage/statistics tests pass (0.953 seconds). Production build passes
(23.28 seconds), retaining node:fs externalization and large-bundle warnings.

No gate is newly accepted: five accepted, ten open. Same-record cached selection
with a mocked camera, diagnostic asset relay and one viewport is not actual-host
acceptance. Next: representative uncached chart/venue cases and the remaining
per-frame/shared-state U3 audit before accepting a device/collection/timing budget.
Nothing was published. Checkpoint 86 measurements below are historical evidence.

## Checkpoint 86 — September 15, 2026

Added an isolated collection-timing mode to the existing owned-browser harness.
Both the 100-event and 1,000-event cases passed on their first runs. Application
runtime remains f3aecc8; this checkpoint changes tests/documentation only.

```sh
node scripts/qa-astroeye-provider-workspace.mjs --node-assets --collections --collection-size=100
node scripts/qa-astroeye-provider-workspace.mjs --node-assets --collections --collection-size=1000
```

Each command owns a fresh browser context with synthetic records in native
IndexedDB. Collection mode skips provider/Director workflows; no provider requests
occur. Sizes are bounded to 25, 100 or 1,000; 25 is available but was not run in
this checkpoint. Collection timing cannot be combined with Director playback.
The existing 20-second mount limit and 60-second whole-run watchdog are unchanged.
The test-only localhost asset relay remains explicit; normal host/module delivery
is not certified. Camera presentation is mocked; no user browser or records are
accessed and no external requests occur.

## Method and results

Chrome/145.0.7632.77, headless Windows, viewport 800 x 600, real AstroEye workspace,
controller, chart SVG, event filters, notebook/note services and native IndexedDB.
Each case seeds N events, one cached chart and synthetic private note/notebook
records. Import validation/storage takes 94.4 ms for 100 events and 776.1 ms for
1,000 events; these single seed times are not repeated import benchmarks.

One warmup precedes five measured iterations per operation. Native reads end when
the storage promise resolves. UI measurements additionally await one animation
frame and force workspace-root layout. They include DOM work but do **not** prove
screen presentation, physical-input latency, full-app paint or GPU frame rate.
Assertions and backup comparisons run outside the timed intervals. Raw samples
are emitted in the JSON report. Nearest-rank sample-p95 equals the maximum with
only five observations; it is not a statistically established production p95.

Milliseconds, median / highest observed sample:

| Operation | 100 events | 1,000 events |
|---|---:|---:|
| Native saved-event read | 4.9 / 8.2 | 35.3 / 45.8 |
| Open workspace and load list | 41.0 / 45.7 | 106.7 / 302.9 |
| Apply filter and update list | 18.0 / 45.7 | 14.8 / 42.5 |
| Select the same cached chart | 38.9 / 42.1 | 206.0 / 405.6 |
| Calculate/render fixed +15-minute preview | 28.2 / 36.5 | 43.9 / 92.7 |

The smaller/larger cases run in separate processes and JIT/GC/scheduling conditions
are not controlled. In particular, the smaller filter median being slower is not
evidence that larger collections are intrinsically faster. Only one cached event
is repeatedly selected and the same preview offset is calculated; cold chart
selection, varied venues, additional house systems and many cached charts remain
outside this baseline.

## Correctness and completion

- Full and filtered lists retain the 25-row page cap and exact collection counts.
- The selected chart and preview instant remain exact; no camera navigation is
  requested. Native database reads and chart/list actions use the real services.
- Measured actions preserve complete event/chart/private-workspace backup bytes.
- Closing and reopening the native database connection preserves all counts and
  exact backup bytes. This is connection reopen, not restart/crash durability or
  a browser quota/eviction guarantee.
- Both runs report no page errors, relay failures, provider or external requests.
- 100-event run: exit 0; cleanup starts at 5.697 s and completes gracefully in
  1.196 s, no force. 1,000-event run: exit 0; cleanup starts at 9.487 s and completes
  gracefully in 1.848 s, no force.
- Syntax checks pass; 18 focused filter/statistics/owned-cleanup tests pass
  (0.285 s). No new full-platform/build run is claimed for this test-only change.

## Follow-up and acceptance boundary

Cached selection is the slowest measured 1,000-event operation. Source inspection
shows selectSavedEvent renders the chart and then calls refreshEvents, which
rereads the full event collection. This identifies work to profile, not proof that
the reread alone explains the measured delay. Next: distinguish storage, chart DOM
and list refresh costs, then consider improvements while preserving freshness and
stale-response protection. Do not remove refreshes merely to improve the number.

No collection support limit, timing budget or release gate is accepted here. U3
still needs representative repeated/cold cases, actual-host/map costs, per-frame
ephemeris/shared-state review and an explicit supported-device/collection budget.
Five gates remain accepted and ten open. User data is untouched; nothing published.
