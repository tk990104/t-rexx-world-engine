# Independent seasonal-transition checks

## Source and selection

Four selected-field [USNO one-day API](https://aa.usno.navy.mil/data/api) responses
at latitude 70N, longitude 0, fixed offset zero/UTC were retrieved September 13, 2026.
API version 4.0.1, coordinates, date/weekday, offset, DST flag, request URL and all
solar entries are retained in `usno-sun-transitions.json`. Moon/phase/label fields
are explicitly omitted. These are synthetic reference locations, not user events.

An internal Astronomy Engine search located candidate dates before independent
USNO retrieval. This is targeted edge-case selection, not a random accuracy sample.
May 15/16/17 and July 26 requests succeeded. July 27/28 failed with TLS handshake
errors, including one bounded retry per request, and were excluded without filling
in their values from the production engine. Certificate verification was not disabled.

## Contract and results

The existing 120-second discrepancy screen and 240-second external-boundary probe
spacing were retained before comparison. Reference times are minute-rounded UT1;
comparisons use UTC at this precision for these modern dates. As [USNO explains](https://aa.usno.navy.mil/faq/RST_defs),
high-latitude observed rise/set times are especially sensitive to atmospheric and
horizon conditions. Sampled numerical agreement is not an observational guarantee.

| Date in 2024 | Source solar shape | Rise discrepancy (s) | Set discrepancy (s) |
| --- | --- | ---: | ---: |
| May 15 | Rise and set | 17.435 | 16.157 |
| May 16 | Rise only | 7.256 | Absent, matches |
| May 17 | Continuous daylight | Absent, matches | Absent, matches |
| July 26 | Set only | Absent, matches | 10.060 |

The separate transition pack declares and verifies each expected shape, date and
observer. Its parser explicitly opts into single-boundary days. Ordinary reference
parsing still rejects missing rise/set entries. Empty data, duplicate boundaries,
contradictory polar notices, shape changes and metadata mismatches fail validation.
A deliberately shifted July sunset fails the unchanged numerical screen. Fixed
whole-day searches test absent boundaries as well as present ones; absence is not
treated as an omitted comparison.

## Planetary-hour behavior

- The May 15 sunrise, sunset and May 16 sunrise define the last complete cycle.
  All 24 source-derived segment midpoints pass hour, period, traditional ruler and
  interval containment checks. The rounded night is just twelve minutes long.
  Ruler assertions are internal traditional-rule checks, not USNO-provided data.
- Four minutes before the rounded last sunrise, the preceding Wednesday planetary
  day still applies. Four minutes after it, the result is unavailable. The following
  continuous-daylight sample is unavailable too.
- Separately, one millisecond before the computed last sunrise remains hour 24;
  exactly at and one millisecond after it are unavailable, including with a fresh
  cache. This software-edge check is not an independently measured millisecond time.
- Four minutes before/after July 26's first returning sunset, and at noon that day,
  results remain unavailable: sunset alone does not supply the required preceding
  sunrise and following sunrise. Unavailable results have no fabricated ruler,
  day ruler, hour number or interval endpoints.

## Remaining scope

This supplies northern continuous-daylight and seasonal-onset evidence plus the
first returning sunset. It does not yet externally verify restoration after the
first returning sunrise: the July 27/28 references could not be retrieved. Southern
seasonal transitions, polar-night transitions and broader geographic/date coverage
also remain outside this pack. A2 remains open; no other release gate is closed.
No production calculations, saved charts, browser state, dependencies or licenses
were changed by this validation-only checkpoint.

Offline commands:

`node scripts/astroeye-sun-transitions.mjs`

`node --test src/modules/astroeye/calculation/sunTransitions.test.mjs`

## Checkpoint 47 verification — September 13, 2026

All 301 platform tests passed in 22.69 seconds, including six new transition tests.
The standalone four-day comparison passed. The combined solar-reference and
transition subset passed all twenty tests. No production build or browser check
was repeated for this test/documentation-only checkpoint.

## Internal recovery follow-up — checkpoint 48

July 27/28 reference retrieval again failed with TLS handshake errors; the web
retrieval fallback also returned no data. No new external reference was accepted.
The separate `sunRecovery.test.mjs` is explicitly labeled **internal consistency
only**, and its calculated timestamps were not added to the USNO fixture pack.

At 70N, July 27's computed first sunrise changes unavailable to hour 1, owned by
Saturday/Saturn. One millisecond before it remains unavailable with no fabricated
hour fields; exactly at and one millisecond after it give the same first hour.
All 24 subsequent computed edges pass before/exact/after checks and fresh-cache
agreement; the next sunrise starts Sunday/Sun's planetary day.

Forward, reverse and repeated date navigation across continuous daylight and the
resumed cycle yields identical results with fresh, warm and one-entry caches.
Inputs and result snapshots are not mutated. A presentation-unit check traverses
Unavailable → Boundary uncertain → interior hour and back, confirming stale text
and uncertainty flags clear. This is not a browser walkthrough.

These checks establish deterministic recovery, not external timing accuracy.
Returning-sunrise reference validation and A2 remain open. Avoid blocking unrelated
work on repeated retrieval attempts; supported-date-range work in A3 can proceed
while the external-reference gap remains explicitly documented.

Checkpoint 48 verification: all 304 platform tests passed in 21.20 seconds. The
three-test internal recovery subset also passed independently. No build or browser
check was repeated for these test/documentation-only changes.
