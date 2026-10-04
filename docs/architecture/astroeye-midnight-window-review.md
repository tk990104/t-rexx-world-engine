# Southern midnight event-window comparison

October 4, 2026 — checkpoint 120, unchanged application runtime from `3172ae8`.

## Contract decided before comparison

The fixed-day comparison remains strict and unchanged. A separate bounded window
comparator examines all events from January 24 00:00 UTC through January 27 00:00 UTC
(end excluded), at 70S/0. This uses the unchanged stored USNO responses, including
every sunrise and both January 25 sunsets. No retrieval, timestamp rewriting,
event removal, production change or tolerance adjustment is involved.

The source event list is sorted by absolute time. The calculated list is obtained
by repeated whole-window searches, independently of the source event count or
timestamps. Searches advance one second beyond a root, matching the production
stable collector's root-separation convention; this is not a general proof for
hypothetical same-kind roots less than one second apart. The search count and total
events are capped; backward, malformed or excessive roots fail explicitly.

Comparison requires equal nonzero counts, strict chronological order, one-to-one
matching by index and kind, and the existing 120-second screen for every pair.
Extra, missing, duplicate, reused, reordered, wrong-kind or out-of-window events
cannot disappear through nearest-neighbor matching or filtering. The window is
deliberately wide enough that the disputed midnight is internal, not an outer edge.

## Results

All five event pairs pass, including all three sunsets:

| Source UTC | Kind | Absolute discrepancy |
| --- | --- | ---: |
| 2024-01-25 00:00 | Set | 10.468 s |
| 2024-01-25 00:25 | Rise | 15.964 s |
| 2024-01-25 23:33 | Set | 20.654 s |
| 2024-01-26 00:52 | Rise | 14.046 s |
| 2024-01-26 23:18 | Set | 23.154 s |

The first computed sunset remains `2024-01-24T23:59:49.532Z`; the source remains
January 25 00:00. Its `crossesUtcDate` flag is true. Whole-window search anchors
can yield slightly different millisecond roots from single-day searches; both
remain far inside the unchanged screen, and neither is substituted into app data.

This resolves the **event-timing comparison** gap for the two previously unresolved
days without asserting identical daily classifications. The report keeps the old
daily failure and unsupported multi-set result in `dailyResults`, alongside
`dailyClassificationAccepted: false`. The ordinary single-pair parser is unchanged.

The resumed cycle uses January 25 sunrise, its later sunset and January 26 sunrise.
All 24 source-derived midpoints are sufficiently separated from edges and pass
number, period, traditional ruler, containment and endpoint checks. The earlier
midnight sunset is still checked independently and is not dropped to construct
this cycle. Combined decisive hour coverage increases from 216 to **240**, with
the existing **24 precision-limited northern assignments still unresolved**.
Ruler checks remain internal traditional rules, not source-provided predictions.

## Reproduce, limitations and next decision

`node scripts/astroeye-solar-event-window.mjs` prints the scoped report and exits 0
only if every event pair matches. The previous
`node scripts/astroeye-southern-transitions.mjs` still exits 1: it tests the stricter
daily contract, not this window contract. Do not use the new command to silently
declare daily classification acceptance or overall A2 acceptance.

Six new focused tests pass (0.792 seconds). They include deliberate omissions,
extras, duplicates, ordering/kind errors, changed source timing, invalid roots,
search bounds and the exact 120-second acceptance boundary. All 577 platform tests
pass (44.834 seconds), with zero failures/cancellations/skips; the standalone
window report exits 0 and diff-whitespace check passes. No production build, browser,
full-repository or allocation rerun is claimed. Saved reference bytes, production
models, user charts, preview and settings are unchanged. No publication.

Remaining A2 decisions: formally record whether event-timing evidence satisfies
the intended use without daily-category agreement, and resolve the 24 short-hour
precision gaps with independent evidence or an explicit support-scope decision.
Five gates remain accepted and ten open; this checkpoint does not waive a gate.
