# AstroEye independent ephemeris validation

## Scope and result

The first external reference pack compares the production Astronomy Engine 2.1.19 adapter against NASA/JPL Horizons. All ten bodies pass at 15 instants: five central dates and six hours before/after each. This provides 150 position samples (300 longitude/latitude comparisons) and 50 comparisons of finite-difference motion.

Central UTC dates are 2000-01-01 12:00, 2024-04-08 18:00 (solar-eclipse date), 2026-09-11 00:15 (the workspace test event), 2028-02-29 12:00, and 2030-06-21 00:00. These are computational samples, not assertions about real sports schedules.

| Body | Maximum longitude difference, arcseconds | Maximum latitude difference, arcseconds |
| --- | ---: | ---: |
| Sun | 1.308 | 0.858 |
| Moon | 5.358 | 1.233 |
| Mercury | 8.126 | 1.844 |
| Venus | 9.906 | 1.527 |
| Mars | 2.191 | 1.910 |
| Jupiter | 4.080 | 6.244 |
| Saturn | 10.152 | 15.298 |
| Uranus | 11.029 | 10.945 |
| Neptune | 12.107 | 9.694 |
| Pluto | 2.219 | 0.820 |

Maximum motion difference is 0.000226 degrees/day. The longitude and latitude acceptance limits are each 60 arcseconds, selected before comparison to match [Astronomy Engine's stated one-arcminute design accuracy](https://github.com/cosinekitty/astronomy). These five dates establish sampled agreement, not accuracy over every supported date.

## Reference conventions

Each stored response identifies the target center, Earth center (`500@399`), API signature, ephemeris sources, observation conventions, exact query, and retrieval time. The ten body IDs are 10, 301, 199, 299, 499, 599, 699, 799, 899, and 999; planet centers are used rather than planetary-system barycenters.

[Horizons quantity 31](https://ssd.jpl.nasa.gov/horizons/manual.html#obsquan) supplies apparent, observer-centered IAU76/80 ecliptic-of-date longitude and latitude. The requests use airless geocentric observations, Julian-day input, and UT time (UTC for these modern dates). The raw headers retain the future leap-second assumptions, which can affect refreshed future-date results.

AstroEye uses `SunPosition`, `EclipticGeoMoon`, and `Ecliptic(GeoVector(..., true))` for the other planets. Horizons and Astronomy Engine use different models and correction details; this is a tolerance comparison, not an assertion of identical relativistic corrections or frame implementations. It leaves the production adapter unchanged.

Motion is compared using the same centered six-hour sampling window on independently sourced longitudes. A 0.07 degrees/day limit follows conservatively from two endpoint errors of one arcminute across a half-day. Retrograde direction is asserted when the reference motion exceeds that uncertainty; stationary or very slow samples are not treated as a decisive direction check. Longitude differences wrap correctly through zero Aries.

## Reproduce and maintain

Run `node scripts/astroeye-horizons.mjs` for a per-body offline comparison report, or `npm run test:platform` for the integrated validation tests. Neither command contacts NASA.

Original responses live in `src/modules/astroeye/calculation/fixtures/horizons/`. The parser checks target, observer, column labels, numeric ranges, row count, and every epoch. Tests reject error responses, missing tables, mismatched targets/observers/epochs, and unavailable coordinates.

For deliberate reference refreshes, `node --use-system-ca scripts/astroeye-horizons.mjs --fetch Sun` prints a new reviewable record. Fetch one body at a time and save only after reviewing the diff. Do not refresh fixtures automatically in tests or during app startup. The [SSD API policy](https://ssd-api.jpl.nasa.gov/doc/) requires sequential requests and caching, and prohibits embedding the API in a website. The collector stops on HTTP errors without retries.

The responses collected on 2026-09-10 UTC report API signature 1.2, although the [API documentation](https://ssd-api.jpl.nasa.gov/doc/horizons.html) lists 1.3. Tests pin the signature actually received. Review a changed signature and table format before accepting refreshed fixtures.

## Remaining validation

The first [angle geometry reference slice](astroeye-angle-validation.md) now passes
one independently published horizon-intersection example and separate internal
geometry/cusp-rule regressions. It does not close the remaining items below.

- Independent references for ASC/MC and supported house cusps.
- Independent sunrise/sunset boundary checks and planetary-hour rollover checks.
- More dates near planetary stations, zodiac boundaries, and historical time-zone transitions.
- A defined supported date range, with additional samples before expanding accuracy claims.

This validates astronomical coordinates and sampled motion. It does not measure the predictive value of astrological interpretations or sports outcomes. The separate 20-case internal regression pack continues to detect changes throughout event/time-zone/house/planetary-hour processing.
