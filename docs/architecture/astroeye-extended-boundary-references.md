# AstroEye historical, future and retrograde boundary references

## Checkpoint 56 — September 13, 2026 local / September 14 UTC

The planned boundary extension adds 36 independently referenced positions and
twelve centered motion checks. All pass model 4 under the existing tolerances.
This completes the current sampling slice; A3 remains open for consolidated
candidate verification and evidence review, not unlimited reference expansion.

## Fixed samples and independent evidence

Centers were committed to the collector configuration before retrieval. Each
includes positions six hours before and after the center:

| Body | Center dates (12:00 input time) | Purpose |
| --- | --- | --- |
| Sun | 1900 March 20, 22 | Forward Pisces/Aries crossing flanks |
| Sun | 2100 March 19, 21 | Future forward crossing flanks |
| Mercury | 1900 March 11, 15, 20 | Historical direct-to-retrograde window |
| Mercury | 2025 March 28, 31 | Retrograde Aries/Pisces crossing flanks |
| Mercury | 2100 January 25, 30; February 4 | Future direct-to-retrograde window |

A local daily scan located the first Mercury reversal window in 1900 and 2100.
This was sampling assistance only: no local output supplies an expected reference
coordinate or speed. The independent Horizons response supplies both. No samples
were removed or tolerances changed after the reference comparison.

Two complete NASA/JPL responses are stored in
`src/modules/astroeye/calculation/fixtures/horizons-extended-boundary/`. Their
queries, September 14 UTC retrieval timestamps, tables and footers remain intact.
Both use signature 1.2, DE441 target and Earth-center sources, Earth 399,
GEOCENTRIC, airless quantity 31, Julian-date UT and EOP `eop.260911.p261208`.
Quantity 31 is apparent observer-centered IAU76/80 ecliptic-of-date longitude
and latitude; targets are Sun 10 and Mercury 199.

Horizons' retained footers specify UT1 before 1962 and UTC afterward, with held
future leap seconds. Thus the 1900 ISO labels encode requested Julian-date
numbers, not historically established UTC. Future agreement is conditional on
the held-offset policy. Full charts retain the historical approximation and
future uncertainty notices; no time convention is silently upgraded.

The collector used two sequential, bounded requests with no retry, following
the [JPL API policy](https://ssd-api.jpl.nasa.gov/doc/). Windows system CA trust
was used with TLS verification enabled. No application embedding or live test
dependency was introduced. Snapshot guards reject changed sources, conventions,
epochs or dates; the earlier September 13 fixture pack remains unchanged.

## Results and limits

| Body | Positions | Motion centers | Max longitude error (arcsec) | Max latitude error (arcsec) | Max motion error (degrees/day) |
| --- | ---: | ---: | ---: | ---: | ---: |
| Sun | 12 | 4 | 0.652896 | 0.821268 | 0.00004434 |
| Mercury | 24 | 8 | 9.301716 | 4.421772 | 0.00052631 |

Limits remain 60 arcseconds per coordinate and 0.07 degrees/day for centered
twelve-hour motion. All 36 signs are farther than the coordinate tolerance from
their nearest boundary and agree. Solar crossing flanks have positive motion;
the 2025 Mercury flanks have negative motion with Aries before and Pisces after.
Neither flank pair identifies an exact ingress time or provides a twelve-hour
window spanning the retrograde crossing itself.

Historical and future station windows each have decisive positive/negative
flanks and one inconclusive center. Reference speeds at 1900 March 15 and 2100
January 30 are +0.0080048 and -0.0431730 degrees/day. Their numeric discrepancies
pass, but their direction is not certified under the existing threshold. Tests
allow opposite near-zero flags while rejecting incorrect decisive flags.
These are not instantaneous station-root measurements or universal accuracy claims.

## Verification and next step

- Focused old/new boundary suite: 23 passed, 7.47 seconds.
- Complete `npm run test:platform`: 415 passed, zero failures/skips/TODOs,
  56.86 seconds. Full charts check all new positions, derived signs, model identity,
  historical/future metadata, visible caution wording and unchanged event inputs.
- Combined model-4 evaluation of original, range and both boundary packs:
  24 body/pack results, 303 positions (606 coordinate comparisons), 101 motion
  checks, all passing. Both boundary command exit codes are covered by tests.
- `git diff --check` passes. Existing legacy-preservation tests pass.

Only offline scripts, fixtures, tests and documentation changed. The shared
boundary evaluator was extracted without changing the earlier pack's behavior.
No runtime calculations, saved records, dependencies, licenses or preview state
changed. Build/browser checks were not rerun; nothing was pushed or published.

Next is the consolidated A3 candidate run and evidence review: date-range handling,
historical-zone behavior, reference results, legacy preservation and user-visible
time-policy handling. Additional samples are needed only if that review identifies
a specific gap or defect. A1/A2 and the other release gates remain separate and open.
