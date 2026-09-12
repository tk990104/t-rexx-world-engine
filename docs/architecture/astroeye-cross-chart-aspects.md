# Optional cross-chart aspects

In Chart comparison, pin a chart and choose **Show cross-chart aspects**. This compares each of the pinned snapshot's 12 points against each current point, including same-named pairs. Pinned Sun/current Moon and pinned Moon/current Sun are separate pairs. It is not a within-chart aspect calculation. Comparing a chart to itself therefore includes zero-orb same-point conjunctions.

## Calculation and display

`crossChartAspects.js` reuses `compareCharts` for compatibility and `MAJOR_ASPECTS` plus `angularSeparation` for the existing geometric definitions: conjunction 0° ±8°, sextile 60° ±4°, square 90° ±6°, trine 120° ±6°, opposition 180° ±8°. Thresholds are inclusive and applied before rounding. Orb is absolute distance from the exact aspect angle. Rows sort by unrounded orb, with stable point-order ties; this is not a significance ranking.

At most 144 pairs are evaluated. Missing, non-finite and invalid longitude values skip their pairs; visible counts distinguish unavailable data from valid pairs with no matches. Engine/version, zodiac or frame mismatch suppresses rows and disables the control and report. Different house systems retain the existing warning. There is no motion/phase inference across snapshot times, interpretation or prediction.

The table displays pinned point, current point, aspect, separation and orb, with two-decimal degree values. Its height is bounded and the scroll region is keyboard focusable. The option starts off, survives close/reopen and chart changes within this mounted panel, and resets on Clear pinned chart, destruction or reload. Missing/incompatible current charts hide and clear prior rows without discarding the pinned snapshot.

## Ownership and export

The view uses the two existing immutable snapshots. It has no storage, provider, network, camera or clock operations and introduces no dependency or database migration. Aspect labels come from the fixed existing definitions and render as text. Report format 2 includes matches, rules and pair counts only while the option is enabled. Disabled reports explicitly note the omitted section. Record backups, links and tours remain unchanged.

## Verification

40 targeted tests and the isolated browser regression passed. The production build passed with the existing node:fs externalization and bundle-size warnings. No full-globe or inherited release-suite claim is made.

Targeted unit tests cover all five definitions, inclusive and just-outside thresholds, wraparound, antipodes, directed/same-point pairs, stable ordering, input immutability, missing values, compatibility refusal, house-system warnings, the 144-pair ceiling and optional report contents. The isolated browser regression verifies opt-in/out, counts, report/visible-row parity, no record or selection changes, mobile width, focus, panel close/reopen, clear reset, empty matches and suppression/cleanup for incompatible or missing charts. It uses synthetic records with a 60-second watchdog, not the live globe. Download payload dispatch is tested; native file saving is not.
