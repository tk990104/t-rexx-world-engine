# High-latitude angle limitation and visible caution

## Confirmed issue, not a passing accuracy gate

On 2026-09-13, geometric checks reproduced two limitations of the current formula:

- Latitude +80 degrees, local sidereal angle 270 degrees, obliquity 23.44 degrees:
  returned Ascendant 180 degrees; projection onto local east -1.
- Latitude -80 degrees, sidereal angle 90 degrees, same obliquity:
  returned Ascendant 0 degrees; east projection -1.

Both are western horizon intersections. These are constructed orientations, not
published UTC/location fixtures. The test rotates the returned ecliptic vector into
equatorial axes and projects it onto local east, rather than duplicating the angle formula.

At latitude +66.56/sidereal angle 270, or -66.56/90, with obliquity 23.44, the horizon
and ecliptic planes coincide. The normalized intersection coefficients have magnitude
below 1e-12. The formula nevertheless returns a longitude driven by floating-point
residuals, not a well-defined unique Ascendant. Nearby orientations are also sensitive.

[Astrodienst documentation, section 6.4](https://www.astro.com/swisseph/swisseph.htm)
describes its eastern-Ascendant convention and notes that MC may be below the horizon.
This is conceptual reference material only: no Swiss Ephemeris code is imported or
executed. This checkpoint does not claim equivalent behavior or numerical certification.

## User-facing mitigation

Charts with finite chart latitude from 66 through 90 degrees in absolute value show
a caution below the chart title. This conservative support threshold is not a physical
polar-circle constant or certification of lower-latitude accuracy. It uses the chart's
location, not camera position. Missing/invalid metadata is not coerced into a latitude;
absence of this specific warning is not validation.

Selecting an ordinary-latitude chart clears the caution. Displaying a saved chart
does not recalculate or modify it. The notice labels angles and houses provisional.
It remains visible in the compact event-sky layout as well as the full chart layout.

Comparison captures an immutable `highLatitudeCaution: true` flag only when relevant,
without coordinates. Its warning identifies pinned/current sides and retains existing
house-system warnings. The existing report Note section carries the same caution;
numeric rows, aspect filters and report format 3 are unchanged. Incompatible charts
still suppress numeric comparison. Reports reveal a coarse high-latitude classification,
not exact coordinates. Pins created before a hot update need recapturing for the flag.

Event JSON backups, calculated chart records, notes, share URLs and tours are not
rewritten. This is presentation metadata, not a persisted calculation guarantee.

## Verification

- Five `angleCaution.test.mjs` tests cover boundaries, stale-text clearing, frozen
  flags, report-side labeling, coordinate exclusion and the reproduced geometry issues.
  The defect-characterization test must be replaced when correcting the model; passing
  it does not mean the polar result is correct.
- `node scripts/qa-astroeye-angle-caution.mjs` passed in a fresh Chromium profile with
  synthetic data and the real workspace/controller/IndexedDB. It checks chart/pin/report
  warnings, close/reopen, 390/1280 widths and unchanged stored records, without a globe
  or user-preview access. Whole-run watchdog: 60 seconds.
- All 227 platform tests passed; the focused caution/comparison/report run passed 18.

## Required follow-up before A1 closes

This caution does not fix the model or close A1. Implement and verify an explicit
eastern-intersection convention, with unavailable results for coincident or insufficiently
stable geometry. Before changing numerical results, version the calculation model and
define cache/old-record behavior, comparison compatibility and share/tour reproducibility.
Do not silently reinterpret or overwrite saved charts. Keep MC's sidereal-meridian
definition explicit rather than assuming it must always be above the horizon.

Alternatively, deferring polar support requires an explicit user decision plus enforced,
documented scope limits. Until one path is implemented and verified, this remains a
release blocker alongside A1's other independent-reference coverage gaps.
