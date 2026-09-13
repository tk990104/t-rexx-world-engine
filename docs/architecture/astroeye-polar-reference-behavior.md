# Published polar behavior check

## Accepted reference

Dieter Koch's Astrodienst article, [Astrology in polar regions and on the southern
hemisphere, section 3](https://www.astro.com/astrology/in_polar_asc_e.htm), describes
the 78-degree-north example with Ascendants confined approximately to 31 degrees
around the equinoctial points: direct motion around 180 degrees, retrograde motion
around zero, and two half-turn transitions per day.

Retrieved 2026-09-13 through indexed article text; direct retrieval returned browser
verification. The fixture contains only numeric facts, a short behavior paraphrase
and source metadata. No article prose, diagram or external implementation is copied.
The source has no pinned repository revision, so refreshes require manual review.

## Explicitly limited contract

This is an **orientation-behavior** reference, not a table of exact UTC chart outputs.
The source rounds its latitude and angular ranges. Its clock-time narrative does not
provide enough explicit coordinates/time conventions for a precise UTC fixture.
We do not guess those missing details or treat the article's approximate ranges as
arcsecond-accurate expected values.

Before evaluating AstroEye, the fixture fixed latitude 78, adopted obliquity 23.44
degrees (a test assumption, not an article-supplied value), and a one-degree bound
allowance for the rounded example. These parameters are guarded by tests. Widening
them after a failure is not permitted without explicit reference-contract review.

The offline checker samples local sidereal angle every 0.5 degrees over one rotation.
Centered 0.01-degree probes test motion direction except across jumps. Adjacent samples
including the wrap detect jumps greater than 170 degrees. Both motion regions must be
visited, exactly two jumps detected, and the maximum excursion must approach the
published extent within the fixed allowance. No individual jump instant is certified.

Observed: **720 samples**, zero range/motion/invalid failures, **two jumps**, 477 direct
and 243 retrograde samples; maximum excursion **31.511343655 degrees**. This passes the
preselected approximate-bound contract. The old model fails the motion check. Wrong
antipodes, frozen output and missing numbers also fail.

## Run offline

`node scripts/astroeye-polar-references.mjs`

`node --test src/modules/astroeye/calculation/publishedPolarBehavior.test.mjs`

No network, browser, user records or optional provider is used by either command.
The checker is test-only; production calculation code and dependencies are unchanged.

## Reference search audit and next acceptance requirement

The inspected XALEN [house oracle at pinned commit
cc6edbec1f748ebdc4950ae6198f575c5ada73fa](https://github.com/vedika-io/xalen-ephemeris/blob/cc6edbec1f748ebdc4950ae6198f575c5ada73fa/crates/xalen-houses/tests/swiss_houses_oracle.rs)
contains house-cusp rows for latitudes 0, 28, 51, 60 and -34 degrees. It does not supply
the polar ASC/MC fixture needed here. Auxiliary points named “polar ascendant” and
Vertex are not interchangeable with the chart Ascendant. No XALEN or Swiss code was
installed, executed or copied into the product.

A1 remains open. A precise polar reference must supply:

- Independently published ASC and MC, plus the actually supplied house cusp arrays.
- Explicit latitude, longitude, UTC/UT1 convention, epoch and time precision.
- Zodiac, sidereal-time and obliquity conventions, with a versioned source.
- Tolerances chosen before comparison, separating convention discrepancies from
  numerical agreement; both hemispheres and boundary-adjacent cases.

The present check does not validate southern-polar charts, UTC conversion, MC or
house cusps. It does not close the near-degenerate reference gap or remove the
high-latitude caution. No release gate has been waived.

## Checkpoint verification — 2026-09-13

All **265 platform tests** passed in 18.14 seconds, including four new reference
tests. The standalone offline checker also passed. Because this checkpoint changes
only test fixtures, a test script and documentation, no production build or browser
run was repeated. The user's open preview and records were not accessed.
