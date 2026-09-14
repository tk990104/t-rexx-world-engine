# AstroEye station and zodiac reference checks

Follow-up checkpoint 56: [extended boundary references](astroeye-extended-boundary-references.md)
complete the planned older/future and retrograde-crossing slice. Combined packs
now cover 303 positions and 101 motion checks; 415 platform tests pass. The counts
and next steps below describe the earlier checkpoint 55.

## Checkpoint 55 — September 13, 2026

First independent boundary slice: nine Sun positions around the March 2024
Pisces/Aries wrap and eighteen Mercury positions around both April 2024 motion
reversals. All 27 positions and nine centered motion comparisons pass model 4.
Full charts pass the same comparisons and retain correct derived sign labels.
This is sampled agreement, not exact ingress/station timing or full-range certification.

## Predetermined scope and source

`scripts/astroeye-boundary-references.mjs` fixes centers before retrieval:

- Sun: March 19 at 12:00, March 20 at 03:00 and 12:00 UTC, 2024.
- Mercury: March 28, April 1, 5, 21, 25 and 30 at 12:00 UTC, 2024.

Every center includes samples six hours before/after. Unique epochs are sorted;
motion endpoints are found by instant, not assumed to occupy adjacent array slots.
The Sun's interleaved windows specifically exercise this distinction.

Two complete NASA/JPL Horizons responses are preserved under
`src/modules/astroeye/calculation/fixtures/horizons-boundary/`, with request URLs,
September 13 retrieval timestamps, headers, rows and explanatory footers. Both
use signature 1.2, DE441 target/observer source, Earth center 399, geocentric,
airless quantity 31, Julian-date UT and EOP `eop.260911.p261208`. These 2024 UT
samples are UTC according to the retained response convention. Target IDs are
Sun 10 and Mercury 199. The observer-centered quantity is apparent IAU76/80
ecliptic-of-date longitude/latitude, not a local horizon position.

Retrieval followed the [JPL API policy](https://ssd-api.jpl.nasa.gov/doc/): two
sequential requests, 30-second timeout each, no retry, no application embedding.
Node used Windows system CA trust with certificate verification enabled. The
collector pins the reviewed snapshot; a refresh requires explicit guard review.
Tests are offline and reject substituted provenance, kernels, epochs and conventions.

## Tolerances and inconclusive classifications

Existing limits remain 60 arcseconds per coordinate and 0.07 degrees/day for
the centered twelve-hour motion estimate. Reference signs are decisive only
farther than 60 arcseconds from a multiple of 30 degrees. Reference direction
is decisive only above 0.07 degrees/day in magnitude. Equality is inconclusive.
No threshold was tightened after seeing the reference results.

| Body | Max longitude error (arcsec) | Max latitude error (arcsec) | Max motion error (degrees/day) |
| --- | ---: | ---: | ---: |
| Sun | 0.154296 | 0.190008 | 0.00000357 |
| Mercury | 5.744628 | 2.337552 | 0.00045358 |

The Sun samples span 359.1260232 to 0.6163784 degrees across the wrap. Eight
sign comparisons are decisive. March 20 at 03:00 is only 15.94908 arcseconds
from the boundary, so its sign agreement is reported but not certified.
All three solar motion estimates remain positive across the wrap.

Mercury's four decisive centers demonstrate direct/retrograde/retrograde/direct
motion in chronological order. April 1 and April 25 have reference centered
speeds +0.0508106 and -0.0031320 degrees/day: their numeric motion errors pass,
but neither direction is certified under the existing tolerance. These samples
do not locate an instantaneous station root. No live UI warning or calculation
change is introduced; these uncertainty classifications belong to the QA report.

Mutation tests reject shifted coordinates, a frozen position/motion and incorrect
decisive direction. Other tests deliberately allow opposite classifications
within the declared uncertainty margins, proving those are not false accuracy gates.

## Verification and remaining work

- `npm run test:platform`: 404 passed, zero failures, skipped tests or TODOs,
  51.59 seconds. Twelve new boundary tests include full-chart paths.
- `node scripts/astroeye-boundary-references.mjs`: exit 0, model 4 explicitly named.
- The original/range model-4 comparisons and this pack jointly pass 267 positions
  (534 coordinate comparisons) and 89 motion screens. Existing legacy-preservation
  tests still pass. `git diff --check` passes.

No runtime calculation, saved record, dependency, license or preview state changed;
build/browser checks were not rerun for this offline-only change. No publication.
A3 now has first station/zodiac evidence but remains open for older/future boundary
cases, retrograde zodiac crossing coverage and final candidate verification.
A1/A2 and the other release gates retain separate outstanding requirements.
