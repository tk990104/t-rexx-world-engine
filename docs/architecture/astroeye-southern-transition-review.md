# Southern solar transitions and combined A2 evidence review

October 4, 2026 — checkpoint 119, application runtime unchanged from `b3beb68`.

Checkpoint 120 update: the separate [three-day event-window comparison](astroeye-midnight-window-review.md)
matches all five January 24–26 events without dropping the midnight sunset. This
resolves the event-timing comparison gap, not the stricter daily classifications
retained below. It adds 24 decisive hour midpoints, bringing combined coverage to
240 decisive / 24 unresolved. Original reference data and daily report are unchanged.

## Sources and conventions

Twelve [USNO one-day API](https://aa.usno.navy.mil/data/api) responses at 70S/0
were retrieved sequentially with 20-second request caps and certificate verification.
An internal 2024 search selected the dates before retrieval; this is targeted
coverage, not random sampling. The temporary candidate script was removed.
`usno-southern-transitions.json` preserves all solar entries, including the
unexpected two-set day, along with API version, geometry, date/weekday, DST,
offset and exact URLs. Moon/phase/label fields are explicitly omitted.

The unchanged 120-second discrepancy screen and 240-second external probe spacing
apply. Source times are minute-rounded UT1, fixed offset zero, compared with UTC
for these modern dates. Coordinates are north/east-positive degrees and venue
zone UTC. No weather, local terrain or observed-sunrise accuracy is claimed.

## Southern result: ten matched cases, two unresolved

Matching cases are January 26; May 22/23/24; July 18/19/20; and November 16/17/18,
2024. They cover polar-night onset/recovery and continuous-daylight onset. Thirteen
present-boundary comparisons pass (maximum difference 29.059 seconds), and seven
absent-boundary checks agree. Three complete cycles supply 72 decisive hour
midpoints, each farther than the fixed tolerance from its reference-derived edges.
Hour/period, traditional sequence, interval containment and endpoint screens pass.
Traditional rulers are software-rule assertions, not USNO data or predictive evidence.

The following cases are deliberately retained as **unresolved**, not removed:

- **January 24:** USNO reports continuous daylight and no sunset on that date.
  Astronomy Engine finds a sunset at `2024-01-24T23:59:49.532Z`. The fixed-day
  absent-boundary assertion fails. USNO's following day contains a `00:00` sunset,
  10.468 seconds later than this computed root. This suggests a boundary-rounding
  issue, but proximity alone does not justify declaring daily classifications equal.
- **January 25:** the reference contains sunset `00:00`, sunrise `00:25`, and
  sunset `23:33`. The ordinary single-rise/single-set parser correctly refuses the
  shape. The new report validates each boundary's metadata and time, retains all
  three, and marks the comparison unsupported. It does not drop the first sunset.

`node scripts/astroeye-southern-transitions.mjs` prints `passed: false`, ten matched
cases and both unresolved IDs, and intentionally exits **1**. Characterization
tests passing means these gaps remain visible, not that all comparisons pass.
No network calls occur during tests or application startup.

## Consistent precision policy and combined review

Review found that the older northern May-transition test asserted twelve night
hour numbers despite a twelve-minute night: each midpoint was only thirty seconds
from its source-derived edge, inside the 120-second uncertainty screen. That test
now explicitly records twelve unresolved night assignments and checks only the
twelve sufficiently separated day midpoints. No tolerance or calculation changed.
This supersedes the older claim of 24 independently decisive May-transition hours.

| Evidence pack | Reference days | Decisive hour midpoints | Unresolved hour assignments |
| --- | ---: | ---: | ---: |
| Original city/solstice references | 8 | 72 | 0 |
| Northern daylight transitions | 4 | 12 | 12 |
| Northern July recovery | 2 | 24 | 0 |
| Northern polar night | 6 | 36 | 12 |
| Southern transitions | 12 | 72 | 0 |
| Total | 32 | 216 | 24 |

The two southern unresolved reference days are additional to the 24 short-interval
hour assignments, not counted as passing midpoint cycles. Internal millisecond
before/exact/after tests remain separate from independent astronomical precision.
Existing zone/DST/day-rollover and unavailable-result tests remain in the platform
suite. This is a combined evidence review, **not A2 acceptance**.

Concrete remaining A2 work:

1. Define and test cross-midnight, multiple-boundary reference comparison while
   retaining exact source dates and every event; resolve January 24/25 explicitly.
2. Obtain sufficient independent precision for the 24 unresolved hour assignments,
   or obtain an explicit support-scope decision. Do not silently waive them.
3. Re-run and record a final candidate decision with these gaps resolved. No
   universal observational or astrological prediction accuracy claim is implied.

## Verification and safety

Six new focused tests and the explicit non-passing comparison report completed.
After correcting the older midpoint claim, all twelve changed-area tests pass
(1.047 seconds). The final platform run passes all 571 tests (48.607 seconds),
zero failures/cancellations/skips. An earlier pre-correction platform run also
passed 571 tests; it is not the final evidence. The southern CLI intentionally
exits 1 with its two gaps, as described above. Diff-whitespace check passes.
No production build, browser, full-repository or allocation
rerun is claimed. No runtime/model IDs, saved charts, user preview or settings
changed. Nothing published. Five gates remain accepted and ten open; existing
source/redistribution review requirements are unchanged.
