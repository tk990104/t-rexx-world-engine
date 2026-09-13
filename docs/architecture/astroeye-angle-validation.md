# AstroEye angle geometry validation — first reference slice

## What is checked

The existing angle formula now has a pure `calculateAnglesFromOrientation` seam.
`calculateAngles` still obtains apparent local sidereal time and true obliquity from
Astronomy Engine and delegates to that same formula. No chart convention, house
assignment, stored record or dependency was deliberately changed.

The first external numeric fixture is the published PyMeeus 0.5.12
[ecliptic/horizon example](https://pymeeus.readthedocs.io/en/latest/_modules/pymeeus/Coordinates.html#ecliptic_horizon),
retrieved September 12, 2026. It specifies local sidereal time 5 hours, latitude
51 degrees and obliquity 23.44 degrees. Its two reported intersection longitudes
are 169 degrees 21 minutes 29.9 seconds and the antipode 180 degrees away.

The comparison uses 0.1 arcsecond tolerance, chosen before running it from the
source's printed precision (twice its rounding half-step). The measured error of
the first intersection is approximately **0.002712 arcseconds**. This is agreement
with one rounded worked example, not a new accuracy specification for the product.
The fixture records the source, inputs, conventions and tolerance. No PyMeeus
library code was copied and no dependency was installed; the input/output numbers
are the reference. The source uses the same class of trigonometric relationship,
so this is independently published numerical evidence, not an independent algorithm.

## Separate geometric regression checks

`angleGeometry.test.mjs` also rotates a unit ecliptic vector into equatorial axes
and projects it onto the observer's up/east axes. This representation verifies that
the selected Ascendant lies on the horizon and MC on the local sidereal meridian.
It checks eastern orientation only for the tested non-polar latitudes. Cardinal
meridians supply exact geometric MC checks, not externally tabulated MC fixtures.

The grid covers seven latitudes from -80 to +80 degrees and eleven sidereal angles,
including wrap and quadrant boundaries. Date-based checks cover 50 synthetic
time/location combinations and both supported cusp rules. These are internal
geometry, delegation and house-spacing regressions, not independent date-to-angle
or house-cusp reference values. Tests also reject bad orientation inputs and prove
that a wrong antipode or a one-arcsecond perturbation exceeds the fixture tolerance.

## Remaining A1 work — gate stays open

- Independently sourced, date/location-based ASC/MC and full house-cusp fixtures,
  with agreed coordinate, time-scale and obliquity conventions and tolerances.
- External examples in both hemispheres and across longitude/zodiac wrap.
- High-latitude branch semantics and near-degenerate orientations. A point lying on
  the horizon alone does not certify that it is rising/eastern at polar latitudes;
  this slice does not alter or endorse the current polar branch choice.
- Broader supported-date validation; planetary-hour reference checks remain A2 work.

Do not treat passing geometry identities or the single published example as closing
[release gate A1](../ASTROEYE-RELEASE-CHECKLIST.md). The fixture has no UTC date,
geographic longitude or sidereal-time model, and does not identify an MC.

## Reproduce

`node --test src/modules/astroeye/calculation/angleGeometry.test.mjs`

The reference is stored locally in
`src/modules/astroeye/calculation/fixtures/horizon-orientation.json`; tests are offline.
On September 12, 2026 the six new tests plus existing calculation/regression tests
passed (37 total). The complete `npm run test:platform` also passed (218 tests).
No user's browser profile or records were accessed.

The production build passed (236 modules), retaining the existing `node:fs`
externalization and large-chunk warnings. Its first sandboxed attempt failed while
resolving the Vite configuration; the permission-approved retry passed. No browser
walkthrough or full inherited test suite was run for this calculation-only slice.
