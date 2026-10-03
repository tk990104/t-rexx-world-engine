# Independent polar-night transition references

October 3, 2026 — checkpoint 118, unchanged application runtime from `709374b`.

## Selection and provenance

An internal search identified the disappearance and return of sunrise at 70N/0:
November 24/25, 2024 and January 15/16, 2025. Independent
[USNO one-day API](https://aa.usno.navy.mil/data/api) responses were then retrieved
sequentially for November 23/24/25 and January 15/16/17, each with a 20-second cap
and normal certificate verification. This is targeted edge-case selection, not
random or global accuracy sampling. The temporary internal candidate script was
removed; its calculated times were not used as source data.

`usno-polar-night.json` retains the exact queries, API version, geometry,
date/weekday, fixed offset, DST flag and all solar entries. Moon, phase and label
fields are explicitly omitted. No API request runs during tests or app startup.
Reference and observer coordinates use north/east-positive degrees, zero height,
fixed offset zero and UTC venue-zone interpretation. USNO's minute-rounded UT1
values are compared with UTC at that precision on these modern dates.

The existing 120-second screen and 240-second external-boundary probe spacing were
retained before comparison. Atmospheric refraction, apparent solar-radius choices
and local terrain remain limitations, not modeled observations. See
[USNO rise/set definitions](https://aa.usno.navy.mil/faq/RST_defs).

## Results and uncertainty

| Date | Source rise / set, offset zero | Rise / set discrepancy |
| --- | --- | --- |
| 2024-11-23 | 11:02 / 12:30 | 3.474 / 8.509 s |
| 2024-11-24 | 11:18 / 12:14 | 19.964 / 28.634 s |
| 2024-11-25 | Both absent | Both absent in calculation |
| 2025-01-15 | Both absent | Both absent in calculation |
| 2025-01-16 | 12:05 / 12:15 | 32.390 / 6.890 s |
| 2025-01-17 | 11:37 / 12:45 | 25.884 / 27.573 s |

All eight numerical comparisons pass, maximum discrepancy 32.390 seconds. Four
absent-boundary checks also pass; civil twilight is not mistaken for sunrise.
The last complete November cycle supplies 24 decisive source-derived midpoints;
the January recovery night supplies 12 more. These 36 samples pass hour number,
day/night period, interval containment, endpoint tolerance and traditional ruler
assertions. Rulers are internal traditional-rule checks, not USNO data or evidence
of predictive validity.

**Twelve January daylight midpoints are explicitly unresolved.** The first returning
day is only ten source-rounded minutes long, or roughly fifty seconds per unequal
daylight hour. Each midpoint is closer to an edge than the fixed 120-second screen.
Tests assert exactly 36 decisive and 12 unresolved cases rather than silently
counting ambiguous hour assignments as independent passes. More precise reference
evidence would be needed to certify those twelve assignments; tolerances are not
narrowed or widened after seeing the result.

Four-minute probes check the last complete night, unavailable output after the last
sunrise (a same-day pair without a following sunrise is insufficient), polar-night
absence, returning daylight, sunset and next-day rollover. The brief returning day
is checked for period/day ruler without claiming its exact sub-minute hour number.
All unavailable results omit invented hour/ruler/interval fields.

Separately, production-derived millisecond edges are checked before/exact/after
onset and throughout the first returning 24-hour cycle, including fresh caches.
These establish deterministic software partitioning, not independent millisecond
astronomical accuracy. Application rules, model IDs and archived charts are unchanged.

## Reproduce and remaining work

`node scripts/astroeye-polar-night.mjs` reports the twelve present/absent comparisons
offline. `polarNightReferences.test.mjs` rejects changed coverage, altered tolerance,
contradictory/missing solar data, wrong coordinates/queries and a shifted sunrise.

The new six-test focused check passes (1.205 seconds), and the offline report
passes. All 565 AstroEye/platform tests pass (54.824 seconds), zero failures,
cancellations or skips. Diff-whitespace check passes. No build,
browser, full-repository or allocation rerun is claimed for this test-only work.
No user preview, saved records or settings were accessed; nothing published.

Northern polar-night coverage is now present. Southern seasonal transitions,
the explicitly unresolved short-day hour assignments and consolidated A2 review
remain outstanding. No gate is closed: five accepted, ten open. Existing source
and redistribution review requirements remain in force.
