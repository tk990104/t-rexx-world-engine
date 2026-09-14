# Published quadrant and wrap references — checkpoint 59

September 13 local / September 14 UTC, 2026. Starting commit `3fc176e`;
production runtime remains the A3-reviewed candidate `6c96b86`.

## Evidence and conventions

Fifteen numeric assertions are transcribed from CircularNatalHoroscopeJS at
commit `76e150f64a3525797afe5b7ce118c2c63a1d59bd`:

- [Published assertions](https://github.com/0xStarcat/CircularNatalHoroscopeJS/blob/76e150f64a3525797afe5b7ce118c2c63a1d59bd/tests/utilities.astronomy.test.js).
- [Default obliquity and angle conventions](https://github.com/0xStarcat/CircularNatalHoroscopeJS/blob/76e150f64a3525797afe5b7ce118c2c63a1d59bd/src/utilities/astronomy.js).
- [Pinned Unlicense](https://github.com/0xStarcat/CircularNatalHoroscopeJS/blob/76e150f64a3525797afe5b7ce118c2c63a1d59bd/LICENSE).

The four Ascendant inputs include northern and southern latitudes. Eleven
Midheaven inputs cover every quadrant, cardinal orientations, both sides of
180 degrees and the wrap from near 360 to the first quadrant. Selected source
assertions, not AstroEye-generated expectations, supply the expected numbers.
The already-covered 51N/75-degree Ascendant example is not duplicated here.

All use the source's default obliquity of 23.4367 degrees. The existing matched
orientation tolerance of 0.36 arcseconds was selected before running comparisons
and was not widened. The checker calls model 4's pure orientation seam. MC is
latitude-independent; its zero-latitude adapter input is not a published venue.
No upstream implementation was installed, executed or copied into the app.

The source's informal date comments are not converted into UTC fixtures. These
are **orientation checks only**, not date-to-sidereal, UTC, polar-boundary or
house-cusp certification. Both implementations use related classical geometry;
agreement does not independently prove their common assumptions.

## Offline checks

```text
node scripts/astroeye-orientation-references.mjs
node --test src/modules/astroeye/calculation/orientationReferences.test.mjs
npm run test:platform
```

All fifteen reference comparisons and four focused tests pass. Tests reject
missing/reordered/duplicated cases, changed source and conventions, a widened
tolerance, reversed latitude, shifted sidereal inputs, a one-arcsecond expected
error, wrong antipodes and nonfinite results. Additional plus/minus full-turn
checks are explicitly internal wrap equivalence, not new independent samples.
Neither the checker nor normal application startup retrieves reference data.

Full regression result: all 426 platform tests passed in 52.81 seconds on
Windows with Node 24.20.0; no failures, skips or TODOs. The focused four-test run
also passed independently. `git diff --check` passed.

## Remaining gates and retrieval boundary

A1 stays open: this advances its quadrant/wrap evidence, but does not replace
accepted polar date/time fixtures or resolve the separate Swiss candidate's
redistribution review. That candidate remains outside Git. A3's candidate decision
is unchanged. No gate is waived and fourteen release gates remain open.

For A2 this checkpoint tried the web retrieval path for USNO July 27 and July 28
daily data at 70N/0, plus the official annual-table route. Each returned a
non-retryable retrieval error and no data. These are tool retrieval failures,
not proof that the public service is globally down. No new solar fixture was
accepted, no production result was substituted, and no more retries ran.

Only offline fixtures, tests, scripts and documentation changed. No production
math, dependencies, application license, user records or open preview changed.
Build/browser checks are not repeated for this offline-only checkpoint. No push,
tag, deployment or external publication is part of this work.
