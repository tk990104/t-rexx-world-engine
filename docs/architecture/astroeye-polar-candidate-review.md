# Polar numerical reference candidate — checkpoint 58

September 13 local / September 14 UTC, 2026. Runtime candidate: `6c96b86`;
review started from `2925d9e`. No production calculations changed.

## Source and distribution boundary

The candidate uses selected numerical inputs/outputs from
[Swiss Ephemeris setest/t.exp](https://github.com/astrorigin/swisseph/blob/1090b1a0573cce6a981b468b4b8355ba64e23474/setest/t.exp),
pinned to commit `1090b1a0573cce6a981b468b4b8355ba64e23474`.
The source header identifies version 2.10.03, generated local time
`14.12.2023 16:48:13`, and shared-library SHA1
`E683A22150EDB3D012662DC35F582BF32FC3D744`. Retrieved September 14 UTC.
Discovery used Moira's polar-reference audit; its license is not a license for
the original Swiss output. The original pinned source supplied the numbers.

The upstream [license notice](https://github.com/astrorigin/swisseph/blob/1090b1a0573cce6a981b468b4b8355ba64e23474/LICENSE)
and [official licensing information](https://www.astro.com/swisseph/swephinfo_e.htm)
require separate review. **Redistribution of this reference selection is not
cleared.** No licensing option was selected or purchased. No Swiss library code
was installed, copied into this application, linked or executed.

The numerical selection stays outside Git at workspace
`outputs/references/polar-house-candidate.json`. Do not add it to the MIT
application, public fixtures, CI artifacts or release bundles without a recorded
rights disposition. Only the authored checker, synthetic plumbing tests and this
review are in the repository. The local pack is not a redistributable A1 fixture.

## Fixed coverage and comparison

- Source suite 6, case 1 (`swe_houses`), successful `rc: 0` cases.
- Latitude +89.9 and -89.9, east longitude 0; February 11, 2013 at
  00:00, 06:00, 12:00 and 18:00 UTC (JD 2456334.5 through 2456335.25).
- Equal and Whole Sign: 16 cases, eight distinct time/location contexts,
  all twelve cusps each (192 cusp comparisons), plus ASC and MC per case.
- Equal source sections: 6.1.397/400/403/406 and 6.1.1237/1240/1243/1246;
  Whole Sign: 6.1.421/424/427/430 and 6.1.1261/1264/1267/1270.
- The source's `ihsy` includes high bytes; the low byte (`Number(ihsy) & 255`)
  identifies E (69) or W (87). No sidereal/ARMC override cases were selected.
- Before comparison, retain the existing 60-arcsecond coarse discrepancy screen
  for ASC/MC/Equal cusps and exact equality for Whole Sign cusps. These are not
  newly fitted tolerances or a universal precision claim.

All 16 local comparisons pass calculation model 4. Maximum ASC/Equal cusp error
is 0.000279 arcseconds rounded upward; maximum MC error is 0.027005 arcseconds
rounded upward. Every Whole Sign cusp agrees exactly. The samples cover both
hemispheres and four MC quadrants, but only one day and stable polar-cap contexts,
not exact jump/degenerate instants or broader date/geographic coverage.

## Reproduction and regression checks

From the repository, with the local pack present:

```text
node scripts/astroeye-polar-candidate.mjs --fixture ../../outputs/references/polar-house-candidate.json
npm run test:platform
```

The checker requires an explicit path, performs no retrieval and rejects missing,
duplicated, relabeled or malformed coverage. Wrong angles/cusps fail comparison.
Its four unit tests use manufactured values and an injected fake calculator:
they validate checker plumbing, not astronomy and not upstream data authenticity.
The separate local CLI run supplies the numerical comparison evidence.

All 422 platform tests passed in 57.22 seconds on Windows/Node 24.20.0. No build or
browser check was repeated for this offline-only change. User preview, saved
records, dependencies, runtime math and application license remain unchanged.

## Gate decision and next work

**A1 remains open** pending accepted distributable fixtures and the remaining
boundary/coverage review; high-latitude warnings remain. L2 must review the rights
disposition before any promotion of this pack. A3's candidate closure is unchanged;
fourteen release gates remain open. Nothing was pushed or published.

A2 returning-sunrise retrieval also remains blocked: one bounded Node request and
one Windows-native request for July 27, 2024 at 70N/0 failed TLS transport. No
response became a fixture; July 28 was not requested this checkpoint. See the
[solar transition record](astroeye-sun-transition-references.md). Do not treat
internal recovery tests as external timing validation or automatically loop retries.
