# AstroEye ten-body historical and endpoint references

## Checkpoint 54 — September 13, 2026

The historical/endpoint pack now covers all ten supported bodies. Model 4 passes
all 90 positions (180 coordinate comparisons) and 30 centered motion screens.
Together with the unchanged original pack, this is 240 positions, 480 coordinate
comparisons and 80 motion screens. This is sampled agreement, not certification
of every date in the approved 1900–2100 range. A3 remains open.

No production calculations, model IDs, tolerances, dependencies, licenses or user
records changed. This checkpoint adds seven raw reference files and strengthens
the offline validation scripts and tests. The preview and its storage were not accessed.

## Source and sampling

Each body has samples at 06:00, 12:00 and 18:00 UT on January 1, 1900,
June 21, 1950 and December 31, 2100. The three noon samples are motion centers;
each motion comparison uses the surrounding twelve-hour longitude difference.
The new Venus-through-Pluto files add 63 positions and 21 motion checks.

Full NASA/JPL Horizons API responses, exact request URLs, retrieval timestamps,
headers, numeric tables and explanatory footers are stored under
`src/modules/astroeye/calculation/fixtures/horizons-range/`. The September 13
snapshot uses API signature 1.2, quantity 31, Earth center 399, GEOCENTRIC,
airless, Julian-date UT inputs and EOP file `eop.260911.p261208`.
The quantity is apparent IAU76/80 ecliptic-of-date longitude/latitude.

The actual target and observer source kernels are pinned separately, not assumed
to be DE441 for every body:

| Target (ID) | Target source | Earth-center source |
| --- | --- | --- |
| Sun (10) | DE441 | DE441 |
| Moon (301) | DE441 | DE441 |
| Mercury (199) | DE441 | DE441 |
| Venus (299) | DE441 | DE441 |
| Mars (499) | mar099 | DE441 |
| Jupiter (599) | jup365_merged | DE441 |
| Saturn (699) | sat441l | DE441 |
| Uranus (799) | ura184_merged | DE441 |
| Neptune (899) | nep098_merged | nep098_merged |
| Pluto (999) | plu060_merged | DE441 |

The collector rejects changed target/center sources and EOP snapshot in addition
to existing query, signature, date, target, observer, atmosphere, epoch and column
checks. Future refreshes require deliberate provenance review and guard updates.

Retrieval followed the [JPL API policy](https://ssd-api.jpl.nasa.gov/doc/):
one request at a time, explicit per-body invocations, bounded 30-second requests,
no automatic retries or application embedding. An initial Venus fetch failed
certificate validation; a single explicit retry with Node's `--use-system-ca`
used Windows' trusted certificate store successfully. TLS verification was not
disabled. The remaining six requests succeeded sequentially. Tests use only the
stored responses and never contact the service.

The retained Horizons footers describe UT as UT1 before 1962 and UTC afterward,
holding the last known leap second for future dates. ISO `Z` sample labels encode
the requested Julian-date value, not an assertion that historical UTC existed or
future UTC offsets are known. Model 4's visible historical/future policy caveats
remain unchanged; see [model 4](astroeye-calculation-model-4.md).

## Results under unchanged limits

Limits remain 60 arcseconds per coordinate and 0.07 degrees/day for centered
motion. Direction is asserted only when reference speed exceeds the existing
decisive threshold. Slow outer-body samples do not certify station timing or
every retrograde classification.

| Body | Maximum longitude error (arcsec) | Maximum latitude error (arcsec) | Maximum motion error (degrees/day) |
| --- | ---: | ---: | ---: |
| Sun | 1.251180 | 0.974232 | 0.00003771 |
| Moon | 2.567268 | 1.057032 | 0.00010325 |
| Mercury | 1.099368 | 1.909008 | 0.00015699 |
| Venus | 1.216944 | 1.047852 | 0.00003050 |
| Mars | 0.586044 | 1.938528 | 0.00002121 |
| Jupiter | 2.472876 | 4.015188 | 0.00000641 |
| Saturn | 6.276132 | 18.917316 | 0.00001109 |
| Uranus | 2.281968 | 15.850548 | 0.00001020 |
| Neptune | 14.567400 | 3.296808 | 0.00000921 |
| Pluto | 8.448444 | 1.104984 | 0.00000983 |

Across both packs, maxima are 14.567400 arcseconds longitude (Neptune), 18.917316
arcseconds latitude (Saturn) and 0.00020685 degrees/day motion (original-pack Moon).
All pass. The legacy models 1–3 diagnostic still fails the preserved late-2100
Moon samples and exits 1; its other nine bodies pass. No legacy result is replaced.

## Verification and next work

`npm run test:platform`: **392 passed**, zero failures, skipped tests or TODOs,
49.41 seconds. The full-chart integration test now checks all 90 range positions.
Scope guards, ten-body provenance checks, active-model motion checks and source
mutation rejection pass. Existing legacy byte-preservation checks also pass.

`node scripts/astroeye-utc-tt-validation.mjs`: exit 0; all twenty body/pack results
pass. `git diff --check` passes. Build and browser checks were not rerun because
this checkpoint changes only offline scripts, fixtures, tests and documentation.

Next: independently referenced station and zodiac-boundary cases, with sampling
and tolerances declared before comparison, followed by the complete candidate
rerun. A1 (angles/houses), A2 (solar boundaries) and the other release gates retain
their separate outstanding requirements. This checkpoint does not close a release
gate or authorize remote publication.
