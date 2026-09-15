# AstroEye performance baseline

## Checkpoint 85 — September 15, 2026

Added a reproducible synthetic CPU benchmark and optimized saved-event filtering
and sorting. Sort now parses each UTC instant once per invocation instead of in
every comparator call. An empty search skips searchable-text construction after
the inclusive date checks. Results retain original record references, stable ID
tie ordering and fresh-array behavior; there is no persistent cache or migration.

```sh
node scripts/qa-astroeye-performance.mjs
```

The parent starts one owned worker and terminates it after 60 seconds, including
if synchronous CPU work stalls. The harness uses deterministic synthetic records,
real filtering/paging/calculation code and real Cesium EntityCollection objects.
Storage is an in-memory array; requestRender is a no-op. One layer-state subscriber
models the workspace subscription. It neither opens a browser nor accesses user
records or live services. Fixture generation and correctness assertions are outside
individual timed sections. Two warmups and nine measured samples are reported,
including raw values; p95 uses nearest rank and therefore equals the maximum with
this small sample count. This is not a statistically established browser p95.

### Observed results

Windows x64, Node v24.20.0. Baseline used runtime f7bf98b; the second run included
this checkpoint's optimization. No tests or builds ran concurrently with either
benchmark. Different worker/JIT/GC/scheduling conditions remain uncontrolled;
do not attribute every timing difference to the code or claim a universal speedup.

Post-change median / sample-p95 milliseconds:

| Synthetic events | Empty filter | Search, sort, page | Sort, page | Capped marker rebuild |
|---:|---:|---:|---:|---:|
| 25 | 0.009 / 0.031 | 0.071 / 0.115 | 0.018 / 0.055 | 3.255 / 3.908 |
| 100 | 0.013 / 0.021 | 0.370 / 0.459 | 0.062 / 0.064 | 5.843 / 10.474 |
| 1,000 | 0.188 / 0.871 | 2.124 / 8.986 | 1.089 / 1.376 | 9.694 / 14.997 |
| 10,000 (stress only) | 1.731 / 2.141 | 23.933 / 33.302 | 7.608 / 13.311 | 43.912 / 56.494 |

For context, the pre-change 10,000-event sort/page median was 207.023 ms
(sample-p95 382.039), and marker rebuilding was 308.174 ms (387.660).
The pre-change 1,000-event values were 32.276 / 73.037 ms for sort/page and
28.713 / 66.195 ms for marker rebuilding. These are two local observational runs,
not paired statistical estimates. The new regression test independently verifies
the algorithmic improvement: one instant read per record and no stale cache.

Post-change complete-chart / +15-minute-preview median milliseconds were:
1900-01-01: 8.876 / 7.043; 2026-09-15: 5.881 / 7.713;
2100-12-31: 6.168 / 9.103. The highest chart sample was 58.681 ms and highest
preview sample 32.000 ms. All use one synthetic UTC venue at latitude 40,
longitude -75; this does not cover polar or every date/location performance case.
Calculation code is unchanged. Both benchmark runs passed correctness checks and
exited 0; measured harness work after imports was 13.681 s before and 2.972 s after.

### Safety and verification

- List results remain limited to 25 per page; extra saved markers remain capped at
  100 and exclude the selected local event. A 25-event case shows 24 extra markers.
- Refiltering does not reread records. Suspension clears markers, disposal leaves
  unrelated entities intact, and all source-event bytes remain unchanged.
- Chart/preview outputs contain the expected ten positions and exact preview
  offset; calculations do not mutate source events.
- New sort tests compare 1,000 mixed/tied UTC instants against the prior comparator
  in both directions, preserve identity/order and prove changed timestamps are
  read again. Timing-statistics tests cover medians, nearest rank and invalid input.
- All 464 platform tests pass (53.015 s), plus three timing-statistics tests
  (0.270 s). The pre-change focused harness run passed 19 tests (11.198 s).
- Production build passes (16.80 s), with browser-externalized node:fs and oversized
  bundle warnings. Those warnings are not resolved by this checkpoint.

### Remaining U3 work

These sizes are test cases, not accepted support limits. No timing budget or new
release gate is accepted. Native IndexedDB, DOM layout/paint, GPU/terrain costs,
input-to-visible-chart latency and the actual embedded host remain unmeasured.
The 10,000-event case is a stress test, not a launch promise. Next: measure the
mounted workspace with bounded synthetic collections, then propose an explicit
support profile and response-time budget using actual-host evidence. Per-frame
ephemeris and shared-camera/layer behavior still need the complete U3 audit.
Five release gates remain accepted and ten open. No fresh browser acceptance,
live services, user-record changes or publication are claimed.
