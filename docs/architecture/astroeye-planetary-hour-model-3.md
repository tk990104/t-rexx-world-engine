# Stable planetary-hour boundaries — model 3

## Current behavior

New charts use calculation model **3**. It retains model 2's angles, cusps and
planetary calculations, and replaces only the planetary-hour boundary algorithm.
New IDs end in `:model-3`. Model 1 and model 2 calculations and IDs remain supported
explicitly. Untagged charts remain legacy model 1.

## Stable solar roots

Solar searches start from fixed UTC-day buckets for an exact latitude/longitude,
never from the moving chart instant. Each calculation gathers roots for the current
UTC day and the two days on either side. Only roots belonging to their half-open
UTC bucket are retained. Multiple same-kind events in a bucket are allowed, with a
strict three-search limit per direction and a one-second step beyond a found root.
Unexpected results fail explicitly instead of producing a partial chart.

A bounded 128-entry LRU cache stores immutable roots, not chart selections or user
records. The key contains UTC day, latitude and longitude. Changing time zone does
not change astronomical roots; it changes the sunrise's local weekday. Fresh and
evicted caches must produce identical results. There is no network or background job.

The calculator requires one preceding sunrise, one following sunrise and exactly one
sunset between them. Each sunrise must be within two days of the instant. Otherwise
the planetary hour is unavailable. This deliberately does not invent intervals during
polar absence or unsupported transition patterns.

## Exact software partition contract

Day is `[sunrise, sunset)`; night is `[sunset, next sunrise)`. For each interval,
integer edge i is `start + floor((end - start) * i / 12)`. Lookup and ISO serialization
use those same millisecond edges. At an edge the following segment owns the instant;
one millisecond before it belongs to the preceding segment. Segment durations may
differ by one millisecond because of rounding. The displayed length is the rounded
mean interval length, as before.

The planetary day's ruler comes from the preceding sunrise's weekday in the venue
zone, including pre-dawn times after civil midnight. Hour numbers remain 1–12 for
day and 13–24 for night, using the existing traditional sequence.

Results identify `boundaryMethod: utc-day-anchored-half-open-ms`. The existing
`status: exact` means the software found a supported interval; it is not an
observational accuracy claim. The one-second UI caution remains for astronomical
timing uncertainty and for legacy model defects.

## Compatibility and deliberate recalculation

- Old charts are not migrated. Selection, time previews, shared views, tours and
  saved shared copies retain their requested model, including legacy hour defects.
- Adding another house system to a saved event retains a supported saved model.
- New model IDs do not overwrite earlier chart IDs. Mixed-model comparisons remain
  refused; pin the current chart to start a same-model comparison.
- Use **Use as template**, then save a new event, to deliberately calculate model 3
  from an older event. There is no in-place upgrade toggle.
- Unknown model 4 and malformed versions fail before restoration or writes.

## Verification scope

Tests exercise every edge in two full 24-hour cycles (New York's spring-DST solar day
and Sydney winter), at minus one millisecond, exactly at the edge and plus one
millisecond. Exact-edge outputs are checked again with a fresh cache. Further cases
cover UTC midnight, both repeated New York autumn hours, Kathmandu's quarter-hour
offset, Kiritimati's date offset, warm/cold/evicted cache agreement, polar absence and
invalid inputs. Pure integer partition tests cover every millisecond of a non-evenly
divisible interval.

All 20 existing sampled chart fingerprints and model-2 angles/cusps remain unchanged.
The existing USNO reference and 48 midpoint checks run against model 3 without
changing expected values or tolerances. The known-defect tests explicitly run model
2, rather than asserting that the corrected default retains those defects.

These checks resolve the reproduced numerical consistency defect, not all of A2.
Independent polar-day and broader near-polar transition coverage remain outstanding;
the global supported date-range work in A3 is also open. No external ephemeris,
dependency, credentials or licensing change is introduced.

Verification on September 13, 2026: all 289 platform tests passed (23.85 seconds).
The isolated browser check passed for legacy replay, new model-3 provenance/report
output, boundary-notice preview/reset and unchanged synthetic records. The production
build passed (240 modules, 16.07 seconds), with existing node:fs externalization and
large-chunk warnings. No user records were changed by the browser check.
