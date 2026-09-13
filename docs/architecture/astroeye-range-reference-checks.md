# AstroEye historical and endpoint position references

Follow-up: [checkpoint 52's UTC/TT candidate](astroeye-utc-tt-candidate.md) passes
these unchanged references but is not yet activated in charts. The current-model
failure described below remains accurate and visible.

## Checkpoint 51 — September 13, 2026

Status: **A3 remains blocked; the late-2100 Moon coordinate check fails.** This
checkpoint records new evidence and a time-convention diagnostic, not a numerical
correction or certification of the approved 1900–2100 support policy. No production
calculation, chart ID, dependency, license or saved record changed.

## Independent source pack

Three raw NASA/JPL Horizons responses are retained in
`src/modules/astroeye/calculation/fixtures/horizons-range/`: Sun (10), Moon (301)
and Mercury (199), each at nine epochs. Center dates are January 1, 1900, June 21,
1950 and December 31, 2100 at 12:00 UT, with samples six hours before/after each.
There are 27 positions (54 coordinate comparisons) and nine centered motion checks.
These sparse samples do not represent continuous coverage or station cases.

The exact query, retrieval timestamp, API signature 1.2, full response headers,
numeric table and explanatory footer are preserved. Quantity 31 is apparent
geocentric IAU76/80 ecliptic-of-date longitude/latitude, Earth center 399, airless,
planet centers, DE441 source. Parser guards reject changed query, target, observer,
time/atmosphere conventions, signature, epochs, missing rows and invalid coordinates.
The original ten-body, five-center reference pack is unchanged.

Retrieval follows the [JPL API policy](https://ssd-api.jpl.nasa.gov/doc/): one body
per manual invocation, sequential requests, 30-second timeout, no automatic retry,
no application embedding. Tests use stored data only. The snapshot validator pins
the retrieval day and signature; a future refresh requires reviewing and explicitly
updating those guards, not bypassing a failure. Commands print data to stdout;
reviewed fixtures are saved through the repository editing workflow.

## Unchanged screening and observed results

Coordinate tolerance remains 60 arcseconds. Motion tolerance remains 0.07 degrees
per day, with decisive direction checks only above that magnitude. Motion uses the
same centered twelve-hour window as the application. No tolerance was widened.

| Body | Maximum longitude error | Maximum latitude error | Maximum motion error (degrees/day) | Raw result |
| --- | ---: | ---: | ---: | --- |
| Sun | 4.582440 arcsec | 0.974232 arcsec | 0.00003771 | Pass |
| Moon | 84.439692 arcsec | 6.692580 arcsec | 0.00054657 | **Fail: three 2100 longitude samples** |
| Mercury | 9.105120 arcsec | 1.909008 arcsec | 0.00015699 | Pass |

All nine motion screens pass. Moon coordinates pass at the 1900 and 1950 samples;
the three 2100 longitude errors are 84.439692, 83.968488 and 83.455884 arcseconds.

## Time-convention investigation, not a fix

Horizons explains in the retained responses and its
[manual](https://ssd.jpl.nasa.gov/horizons/manual.html) that UT is UT1 before 1962
and UTC thereafter, with the last known leap second held constant for future
dates. The fixture labels ending in `Z` encode the requested Julian-date number;
they do not assert that UTC historically existed in 1900 or that future UTC is known.

Installed Astronomy Engine 2.1.19 (`astronomy.js`, `AstroTime` and
`DeltaT_EspenakMeeus`) approximates UT1/UTC as equivalent and converts that input
to TT with a polynomial. At these 2100 samples the default offset is about 205
seconds. Its bundled `DeltaT_JplHorizons` helper instead clamps the polynomial at
2017, yielding about 69.992486 seconds. This helper is itself an approximation,
not a new Horizons TDB-UT measurement or an authoritative future leap-second table.

The diagnostic passes explicit TT values to `EclipticGeoMoon` using that helper.
The resulting longitude errors are about 1.922, 1.880 and 1.837 arcseconds. This
strongly implicates the differing time conversions as the dominant discrepancy;
it does not prove every remaining frame/position convention matches. Diagnostic
results never substitute for the raw comparison and never change the global
DeltaT function. Tests verify identical production outputs before and afterward.

## Reproduce and interpret honestly

```sh
node scripts/astroeye-range-references.mjs
node scripts/astroeye-horizons.mjs
npm run test:platform
```

The first command must currently exit **1** and report Moon `passed: false`.
The platform suite runs the failing Moon coordinate assertion as an explicit
**TODO release blocker**, while separately verifying that the raw command fails.
A successful engineering-suite exit with this TODO is not a passing accuracy gate.
Sun/Mercury accuracy, motion, provenance, parser and non-mutation checks are normal
tests. Remove the TODO only after a reviewed versioned correction passes the same
unchanged reference tolerance; do not delete the failing samples.

Next: settle explicit UT1/UTC/TT policy, obtain independent time-offset evidence,
then implement and validate a new calculation model with old-model replay intact.
Recheck positions, motion, angles, hours, preview/share paths and all supported
dates affected by a time change. Do not apply a library-global setter: that could
silently affect solar searches and legacy chart replay. Seven other bodies still
need older/endpoint references; station/zodiac cases and final candidate checks
also remain open. A1/A2 have separate unresolved reference requirements.

Verification: 345 platform tests passed and one accuracy assertion remains an
explicit failing TODO (346 total, 39.30 seconds). The focused reference subset
reported 24 passes and the same TODO. The original ten-body offline comparison
passed. No build/browser rerun was needed for scripts, fixtures, tests and docs;
the user's preview and records were not accessed.
