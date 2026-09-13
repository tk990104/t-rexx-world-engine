# Optional cross-chart aspects

In Chart comparison, pin a chart and choose **Show cross-chart aspects**. This compares each of the pinned snapshot's 12 points against each current point, including same-named pairs. Pinned Sun/current Moon and pinned Moon/current Sun are separate pairs. It is not a within-chart aspect calculation. Comparing a chart to itself therefore includes zero-orb same-point conjunctions.

## Calculation and display

`crossChartAspects.js` reuses `compareCharts` for compatibility and `MAJOR_ASPECTS` plus `angularSeparation` for the existing geometric definitions: conjunction 0° ±8°, sextile 60° ±4°, square 90° ±6°, trine 120° ±6°, opposition 180° ±8°. Thresholds are inclusive and applied before rounding. Orb is absolute distance from the exact aspect angle. Rows sort by unrounded orb, with stable point-order ties; this is not a significance ranking.

At most 144 pairs are evaluated. Missing, non-finite and invalid longitude values skip their pairs; visible counts distinguish unavailable data from valid pairs with no matches. Engine/version, zodiac or frame mismatch suppresses rows and disables the control and report. Different house systems retain the existing warning. There is no motion/phase inference across snapshot times, interpretation or prediction.

The table displays pinned point, current point, aspect, separation and orb, with two-decimal degree values. Its height is bounded and the scroll region is keyboard focusable. The option starts off, survives close/reopen and chart changes within this mounted panel, and resets on Clear pinned chart, destruction or reload. Missing/incompatible current charts hide and clear prior rows without discarding the pinned snapshot.

## Ownership and export

### Aspect filters

While cross-chart aspects are shown, **Aspect type** narrows results to one of the five existing types; **Maximum orb** offers standard limits, exact only (0°), 1°, 2°, 3° or 5°. Filters apply immediately to already-calculated matches, using unrounded values and inclusive maximum orb. They never expand a standard threshold: a 5° maximum still permits sextiles only within the standard 4°. Exact only means raw zero orb, not a nonzero value rounded to 0.00°.

The view shows both the original match/valid/skipped pair counts and a separate filtered count. Zero filtered matches does not mean the source values were missing. The 12 same-point longitude rows remain unchanged. **Reset aspect filters** restores all types/standard limits and focuses Aspect type. Settings remain session-only, survive hide/show, panel close/reopen and chart/pin replacement, and reset when the pin is cleared or the panel is recreated. Filtering does not change the pin, selection, clock, camera or records.

Report format 3 explicitly records the active filters and shown/total match counts, exporting only visible filtered aspect rows. It still includes every same-point longitude row and both chart metadata blocks. If aspects are hidden, neither aspect rows nor filter settings are included. Older format 1/2 text files remain readable; these reports are not importable event backups.

The view uses the two existing immutable snapshots. It has no storage, provider, network, camera or clock operations and introduces no dependency or database migration. Aspect labels come from the fixed existing definitions and render as text. Report format 3 includes filtered matches, rules and pair counts only while the option is enabled. Disabled reports explicitly note the omitted section. Record backups, links and tours remain unchanged.

## Verification

Filter checkpoint: 45 targeted tests, the comparison-only browser check, the existing integrated workspace/import browser check and the production build passed. Both browser checks completed separately under their unchanged 60-second watchdogs. The build retained existing externalization/bundle-size warnings; no live-globe or full inherited release-suite claim is made.

The filter checkpoint adds pure unit coverage for filter validation, immutable settings, raw/inclusive orb boundaries, stable ordering, combined/empty filters, standard-limit preservation and filtered report contents. `scripts/qa-astroeye-comparison.mjs` is a separate comparison-only DOM check with synthetic snapshots and a 60-second watchdog. It checks type/orb controls, report parity, reset/clear, retained settings, unchanged snapshots, 390/1280 px layout, incompatible-state suppression and teardown. No native file-save dialog is exercised.

40 targeted tests and the isolated browser regression passed. The production build passed with the existing node:fs externalization and bundle-size warnings. No full-globe or inherited release-suite claim is made.

Targeted unit tests cover all five definitions, inclusive and just-outside thresholds, wraparound, antipodes, directed/same-point pairs, stable ordering, input immutability, missing values, compatibility refusal, house-system warnings, the 144-pair ceiling and optional report contents. The isolated browser regression verifies opt-in/out, counts, report/visible-row parity, no record or selection changes, mobile width, focus, panel close/reopen, clear reset, empty matches and suppression/cleanup for incompatible or missing charts. It uses synthetic records with a 60-second watchdog, not the live globe. Download payload dispatch is tested; native file saving is not.
