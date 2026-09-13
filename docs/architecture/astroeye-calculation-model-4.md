# AstroEye calculation model 4

## Activated September 13, 2026 — checkpoint 53

New charts default to model 4. It activates the tested
[UTC/TT position adapter](astroeye-utc-tt-candidate.md), correcting the late-2100
Moon discrepancy against the stored Horizons samples without widening tolerances.
The approved chart-date policy remains 1900–2100 inclusive UTC. This closes the
specific active-model Moon TODO, not the whole A3 accuracy gate or v0.1 release.

## Deliberately scoped numerical change

Model 4 uses explicit TT conversion for planetary positions and each +/-six-hour
motion endpoint. Signs, house assignments and aspects use those corrected positions.
The pinned policy is `utc-tt-2026-09-13-v1`: estimated pre-1962 UT1-like input,
published subsequent UTC offsets and explicitly provisional held future leap seconds.
Its source table and light-travel implementation are unchanged from checkpoint 52.

Angles/cusps, sky rotation and planetary-hour searches retain their model-3 inputs
and time approximations. No synthetic position clock reaches these components,
and no library-global delta-T setter is used. The chart's `timeConventions` object
records separate positions, angles, planetaryHours and skyRotation policies.
These inherited calculations are not newly precision-certified. A1/A2 remain open.

## Identity and preservation

- Model 4 has a distinct `:model-4` chart ID suffix. Models 1–3 and untagged model-1
  records preserve their numerical results, IDs and replay. No records are migrated,
  automatically recalculated, upgraded or deleted.
- Selection prefers a supported matching cache entry. Adding another house system
  to an older selected event keeps its saved model. New manual/provider event saves
  use model 4; existing saved events do not silently switch.
- Model-4 cached charts must contain the expected time-policy identifiers, exact
  input instant, basis and computed time fields. Missing/changed metadata makes a
  record unsupported before selection or recalculation; storage is left unchanged.
- Shared views and Director recipes allow model 4 and retain the requested model
  during replay and preview. Links contain inputs, not arbitrary calculated metadata.
  Explicit save-copy keeps the restored model. Unsupported future versions refuse.
- Pinned comparisons carry the model and position-policy ID. Mixed models and
  missing/mismatched model-4 position policies cannot yield numeric comparisons,
  cross-aspects or exported comparison reports.

Chart display shows a time-policy note above the wheel, including historical
approximation or provisional-future wording when applicable. The note survives
compact sky layout, updates with preview/selection, and clears for legacy charts.
Pins, comparison reports and static notebook references include the same note.
No venue coordinates or extra collection data are added to these outputs.

## Verification

All 370 platform tests pass with zero failures or TODOs (24.61 seconds). This includes
four new integration tests and all four models through the existing sharing,
Director, save-copy, date-range and cache checks. The prior full-byte fingerprint
for twelve charts across models 1–3 still matches, and the twenty model-3 regression
charts retain their old fingerprints. Full new-model charts pass all 27 range
position samples, not merely a standalone candidate call.

The model-4 offline adapter command passes all 177 stored positions and 59 centered
motion checks, with the unchanged 60-arcsecond coordinate / 0.07-degree-per-day
screens. Late-2100 Moon longitude discrepancy is at most 1.427364 arcseconds.
The original pack spans ten bodies; the older/endpoint pack still spans only
Sun, Moon and Mercury. No additional reference rows were fetched or modified here.

The isolated Chromium check passed actual model-4 form submission, corrected Moon
longitude, future/historical notes, preview/report/share identity, note clearing,
mixed-model refusal, 390/1280-pixel and compact layouts, polar/hour cautions,
out-of-range refusal and archival preservation. It uses synthetic records in a
fresh browser, not the user's preview or IndexedDB.

Production build passed (245 modules, 18.29 seconds) with the existing node:fs
externalization and large-chunk warnings. No new build warning was introduced.

Commands:

```sh
npm run test:platform
node scripts/astroeye-utc-tt-validation.mjs
node scripts/qa-astroeye-angle-caution.mjs
npm run build
```

`node scripts/astroeye-range-references.mjs` intentionally remains an old-model
diagnostic and exits 1 for the preserved Moon discrepancy. Its output now explicitly
identifies `legacyCalculationModels: [1, 2, 3]`; this is not the active-model gate.
The corrected active-model command above exits 0. Legacy reference failure tests
verify preservation, not approval of the old result as accurate.

Next: extend older/endpoint references to the remaining seven bodies, then station
and zodiac-boundary cases and the complete candidate rerun. Broader independent
angle/solar-boundary evidence and the other release-checklist work remain open.
No external publishing, dependency, API-key or licensing change is part of this checkpoint.
