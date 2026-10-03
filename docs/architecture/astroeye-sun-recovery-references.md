# Independent polar-day recovery references

October 3, 2026 — checkpoint 117, application runtime unchanged from `97ebb4f`.

## Previously missing evidence now retrieved

Two [USNO one-day API](https://aa.usno.navy.mil/data/api) responses for July 27/28,
2024, latitude 70N, longitude 0, offset zero, were retrieved sequentially with
20-second request caps and certificate verification enabled. The web retrieval
tool could not access the first API query; direct HTTPS retrieval succeeded for
both dates. No credentials or user records were sent. Earlier failed attempts
remain historical evidence, not accepted data.

The separate `usno-sun-recovery.json` fixture retains API version, geometry,
date/weekday, offset, DST flag, exact request URLs and every solar entry as received.
Moon/phase/label fields are explicitly omitted. Existing fixtures are unchanged.
Dates were chosen by prior internal recovery probes, so this is targeted validation,
not an unbiased sample. Only independently retrieved solar times enter the fixture;
computed millisecond roots remain exclusively internal regression evidence.

## Conventions and results

The existing 120-second discrepancy screen and 240-second before/after probe
spacing were retained before comparison. USNO returns minute-rounded UT1 with the
chosen fixed offset; these modern dates are compared with UTC at that precision.
Different solar-radius/refraction conventions and actual horizon/weather conditions
remain limitations, especially at high latitudes; see
[USNO rise/set definitions](https://aa.usno.navy.mil/faq/RST_defs).

| Date | Source rise | Rise discrepancy | Source set | Set discrepancy |
| --- | --- | --- | --- | --- |
| 2024-07-27 | 00:20 | 8.692 s | 23:29 | 30.175 s |
| 2024-07-28 | 00:45 | 27.955 s | 23:14 | 8.580 s |

All source times above use fixed offset zero. Four numerical comparisons pass.
The first resumed cycle has a source-rounded 76-minute night. All 24 independently
derived hour midpoints pass interval containment, endpoint tolerance, hour number,
period and traditional ruler assertions. Even the shortest midpoint is more than
120 seconds from its source-derived edges. Rulers are traditional-rule checks,
not USNO-provided data or evidence of predictive validity.

Four-minute probes verify unavailable before the returning sunrise, first hour
after it, day/night rollover at sunset and the following sunrise's new planetary
day. Minute-rounded references cannot independently certify exact millisecond
edges; the existing internal before/exact/after and cold-cache tests cover that
software partition contract separately.

## Reproduce and acceptance limits

`node scripts/astroeye-sun-recovery.mjs` prints all four offline discrepancies.
The new `sunRecoveryReferences.test.mjs` rejects wrong dates/locations/URLs,
missing/duplicate boundaries, changed tolerance/probe contracts, and a deliberately
shifted sunrise. Neither tests nor application startup fetch reference data.

- 35 focused solar/hour tests pass in 2.405 seconds.
- All 559 AstroEye/platform tests pass in 40.300 seconds, zero failures/skips.
- Offline comparison command and diff-whitespace check pass.
- No runtime, model, saved-chart identity, dependencies or production rules changed.
- No build, browser, full-repository or allocation suite rerun; no publication.
- User preview, saved records and settings were not accessed or changed.

This resolves the specific July 27/28 recovery-reference gap. A2 still needs its
remaining broader transition coverage and consolidated candidate review; no gate
is automatically accepted. Five gates remain accepted and ten open. No global
observational accuracy, terrain/atmospheric correction or astrology prediction
claim is made. Existing source/redistribution review requirements remain in force.
