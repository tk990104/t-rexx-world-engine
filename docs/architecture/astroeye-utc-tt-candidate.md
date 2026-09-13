# UTC-to-TT position adapter candidate

## Checkpoint 52 — September 13, 2026

The corrected adapter is implemented and passes both stored position-reference
packs. It is **not activated in charts**: new charts still use model 3, models 1–3
remain replayable, and model 4 is still rejected. The current-model Moon accuracy
TODO and A3 release blocker remain visible. This is the implementation prerequisite
for a versioned correction, not the completed model rollout.

## Explicit, pinned time policy

`ephemerisTime.js` identifies the candidate as `utc-tt-2026-09-13-v1`. The normalized
source table retains 39 numeric rows starting in 1962 and retrieval provenance.
The [USNO TAI-UTC table](https://maia.usno.navy.mil/ser7/tai-utc.dat) supplies
fractional historical offsets/drift and later integer offsets. Its 28 post-1972
rows agree with the [IERS leap-second table](https://hpiers.obspm.fr/iers/bul/bulc/Leap_Second.dat)
updated through Bulletin 72 (July 2026). Direct Node retrieval failed certificate
validation, then failed TLS with the system trust store; numeric rows were
transcribed from successfully retrieved web-tool text instead. No TLS verification
was disabled, and the fixture does not claim to be a raw HTTP response.

The [USNO TT definition](https://aa.usno.navy.mil/faq/TT) supplies the 32.184-second
TAI-to-TT offset. The implementation uses three disclosed regimes:

- Before January 1, 1962: preserve an estimated UT1-like input convention and
  the installed Espenak-Meeus delta-T polynomial. A `Z` label here is a civil-time
  representation, not a claim that historical UTC existed or that the estimate
  equals Horizons' historical Earth-rotation reconstruction.
- From 1962: TT = UTC + the effective published TAI-UTC offset, including the
  historical linear drift term, + 32.184 seconds. Table rows own their starting
  instant and exclude the next row's starting instant.
- Beyond the September 13 source snapshot: hold the last published TAI-UTC value
  (37 seconds, hence TT-UTC 69.184 seconds). Returned metadata labels this as
  provisional future leap-second handling, not a prediction of future timekeeping.

This follows the general historical/future distinction explained in the
[Horizons manual](https://ssd.jpl.nasa.gov/horizons/manual.html), not its full EOP,
TT/TDB or reference-frame implementation. There is no automatic online refresh.
Changing the source table or its policy after activation must use a new model
identity, never silently revise a saved chart's replay convention.

Input validation requires explicit UTC, rejects invalid calendar dates and leap
second `:60` strings (JavaScript Date cannot represent them), and bounds work to
1900–2100 with small internal solver padding. The application date policy is not
expanded. Each +/-six-hour motion endpoint is converted independently, including
windows that straddle an offset change. Motion remains degrees per civil input
day over the existing twelve-hour sample window.

## Geocentric-only clock boundary

`utcTtPositions.js` is an explicit opt-in candidate. It shares only the coordinate
and rounding kernel with the existing provider; the default provider still passes
the same three native Date objects as before. Each candidate endpoint is converted
to TT, and a private AstroTime subclass preserves uniform TT when the engine shifts
time for light travel. No global `SetDeltaTFunction` call occurs.

The library-derived `.ut` and `.date` on these private objects are **synthetic**;
they must never replace the event's UTC, world clock, venue time, sidereal rotation,
house-angle input or rise/set input. The adapter returns the unchanged input instant
and separate policy/basis/offset metadata. Positions and output metadata are frozen.
The installed engine's rise/set/search helpers sometimes create fresh AstroTime
objects internally; simply passing a subclass into them would not reliably preserve
a custom policy. That separate problem must not be hidden by a library-global setter.

## Evidence

All 177 stored position samples (354 coordinate comparisons) and 59 centered motion
samples pass the unchanged 60-arcsecond / 0.07-degree-per-day limits. The original
pack covers all ten bodies at five centers; the range extension covers only Sun,
Moon and Mercury at three centers. This is sampled agreement, not continuous
1900–2100 coverage or certification of station/zodiac-boundary precision.

Late-2100 Moon longitude errors are now 1.427364, 1.388484 and 1.348488 arcseconds,
versus the existing model's 84.439692, 83.968488 and 83.455884. Across both packs,
maximum longitude error is 12.114396 arcseconds (Neptune), maximum latitude error
15.298092 (Saturn), and maximum motion error 0.00020685 degrees/day (Moon).

Twenty added tests cover published-offset examples, all 27 later integer leap
transitions, historical drift, explicit future metadata, continuous-TT light-travel
shifts, invalid inputs, both reference packs and unchanged chart replay. A SHA-256
digest captured before editing matches twelve full synthetic charts spanning four
dates and all three existing models after candidate calls, including houses/hours.

```sh
node scripts/astroeye-utc-tt-validation.mjs
node scripts/astroeye-range-references.mjs
npm run test:platform
npm run build
```

The candidate command exits 0; the existing-model range command still exits 1.
Platform tests: 365 passed, one explicit current-model accuracy TODO (366 total,
21.59 seconds). Production build passed: 241 modules in 12.62 seconds, after the
sandbox blocked config resolution and an approved build retry succeeded. Existing
node:fs externalization and large-chunk warnings remain. This production build
checks the shared-kernel refactor, not browser activation of the unimported adapter.
No preview, IndexedDB records, remote writes, dependencies or licenses were changed.

## Next integration checkpoint

Introduce a new calculation-model identity for the corrected positions and their
time-policy provenance. Explicitly document which angle/hour conventions remain
inherited; never pass the synthetic position clock into those components. Carry
the new identity through chart cache selection, previews, shared views, Director,
comparison compatibility, reports and visible historical/future caveats. Verify
old-model selection/exports and replay without migration, then run browser checks
before enabling the new default. Only then resolve the active-model Moon TODO.
Other-body range references, station/zodiac cases and A1/A2 evidence remain open.
