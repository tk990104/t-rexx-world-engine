# Planetary-hour edge investigation and display safeguard

## Confirmed defects — models 1 and 2

On 2026-09-13, exact-edge probes reproduced two consistency defects in the existing
planetary-hour calculation. Astronomy Engine 2.1.19 searches for rise/set from the
requested instant, so changing that anchor can slightly change the returned root.
The unequal-hour partition is consequently not a single stable timeline.

New York (40.7128, -74.006), 2024-03-10, America/New_York:

- A chart at 16:00 UTC returns hour 5 ending at 16:07:49.818 UTC. Recalculation at
  that displayed end returns hour 5 again, with an end of 16:07:49.821 UTC.
- A separately anchored sunrise search returns 11:14:53.782 UTC. Calculating at that
  instant returns hour 24 ending at the instant itself.
- At the separately anchored sunset of 22:57:56.276 UTC, hour 12 can likewise be
  returned with an end equal to the requested instant.

The last two intervals do not contain the instant under the intended half-open
contract, `start <= instant < end`. Probes one second before/after these examples
recover the neighboring expected hour numbers. These are internal reproducible
examples, not independent astronomical timing or universal one-second error bounds.

Three tests deliberately characterize the **existing defects**. Passing those tests
means the problem remains reproduced, not that A2 is satisfied. They must move to
legacy-only coverage when the versioned correction is introduced.

## Display-only safeguard

The workspace no longer shows a definite ruler when the displayed instant is within
one second (inclusive) of either stored hour edge, outside the interval, or lacks
valid timing metadata. It shows **Boundary uncertain**, with a contextual explanation.
Interior results retain their ruler, period and number with an estimate notice.
Unavailable results show their existing reason as literal text.

The one-second margin is a conservative presentation choice, not a measured global
accuracy limit. Cases outside it are not thereby certified. Incomplete/non-containing
intervals receive a distinct explanation instead of being mislabeled merely “near”
an edge. The notice refreshes with the time explorer and cannot retain stale warning
text when the chart changes.

No calculation numbers, models, chart IDs, saved records, share inputs or tour inputs
are changed. JSON backups retain original calculated values, including known legacy
limitations. This is mitigation, **not the numerical correction**. Existing comparisons
and text comparison reports compare longitudes/aspects, not planetary-hour intervals.

## Required correction contract

The next calculation-model checkpoint must:

1. Find solar boundaries from stable, documented anchors rather than the moving
   query instant; the same event/location must use identical roots across an edge.
2. Partition day/night into 12 deterministic integer-millisecond intervals, using
   the same edge values for lookup and serialization. Every valid instant belongs
   to exactly one interval, including at sunrise, sunset and internal divisions.
3. Assign the planetary day from its defining sunrise, with explicit venue-zone
   handling across midnight, DST and unusual solar-day layouts.
4. Retain model-1/2 replay and distinct new chart/cache identities. Do not silently
   alter old saved charts, previews, links, tours or mixed-model comparison rules.
5. Test immediately before, exactly at and immediately after every relevant edge,
   plus stable results when approaching from either direction and through midnight.
6. Preserve explicit unavailable output when a supported solar interval cannot be
   established; do not infer missing sunrise/set events.

A2 remains blocked on this correction and the remaining independent coverage in
[the USNO reference slice](astroeye-sun-boundary-references.md). This checkpoint does
not bump the model number or claim exact-boundary validation complete.

## Checkpoint verification — 2026-09-13

All **280 platform tests** passed in 27.05 seconds, including three known-defect
characterizations and four presentation tests. The isolated 60-second browser check
passed: notice display, time-preview clearing, reset/reopen, narrow/wide layout and
byte-unchanged synthetic records. Production build passed (239 modules, 15.80 seconds)
with the existing node:fs externalization and bundle-size warnings. The user's open
preview and saved records were not accessed by QA.
