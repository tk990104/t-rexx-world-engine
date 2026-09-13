# Polar correction — calculation model 2

## Scope

New manual/provider-reviewed event saves and templates use model 2. Astronomy Engine
remains 2.1.19; no dependency, data provider, credential, database migration or license
change is involved. This corrects the known western-horizon branch, not astrology's
predictive validity or the entire open angle/house validation gate.

## Numerical contract

The initial ASC and MC formulas are unchanged. Model 2 checks the horizon/ecliptic
intersection using coefficients scaled by cos(latitude), avoiding tan(latitude)
growth in the degeneracy test. Both the dimensionless intersection magnitude and
absolute local-east projection must exceed **1e-10**, chosen before running the new
tests as a conservative floating-point stability guard, not an accuracy tolerance.

If the returned ASC points west, model 2 selects its antipode. MC keeps the local
sidereal meridian convention even when below the horizon. Whole Sign and Equal cusps
and planetary house assignments are generated from the resulting ASC as before.
Ordinary eastern-branch results retain their exact numerical values.

Coincident/near-coincident planes and an effectively zero eastern projection throw
an explicit `Angles unavailable` error. The app refuses the entire new chart: it does
not invent a longitude or feed null into downstream wheels, comparisons or reports.
Calculation precedes record writes and selection changes. A failed save/restore keeps
the previously selected chart; the workspace displays the error and keeps the draft.
This is intentionally not a partial planetary-only chart feature.

## Compatibility

- Omitted chart model means legacy 1, never the current default. Explicit models 1/2
  are supported; invalid and unknown versions are refused for calculation/restoration.
- Model 1 retains its original formula and chart IDs, including its documented polar
  defects. Model 2 chart IDs append `:model-2`; both records can coexist.
- Selecting a supported saved chart, previewing time, sharing it, restoring its link,
  creating a tour and saving a shared copy retain its model. Existing records are not
  automatically rewritten. Links/tours preserve the explicitly requested version.
- When a saved event needs another house system, a supported chart for its same kickoff
  supplies the model; otherwise new calculations use model 2. With multiple supported
  matching records, the existing deterministic chart-ID order remains the selection
  policy (legacy ID precedes its model-2 suffix). There is no in-place upgrade toggle.
- To deliberately recalculate an older event, use **Use as template**, then save a new
  event. That new identity uses model 2 and leaves the original available.
- Pins, comparisons and reports continue to reject mixed models. Their model labels
  explain why; pin the current model to begin a same-model comparison.

The generic import/export layer continues to preserve unknown records, while selection
applies stricter compatibility checks. Compatibility is not validation of imported
numerical values. Local notes, privacy boundaries and ordinary camera URLs are unchanged.

## Evidence and remaining work

Geometric tests cover corrected northern/southern branches, near-pole orientations,
unchanged ordinary cases, coincident and nearby planes, and tangent selection failure.
The 20-case internal fingerprint pack now tests each model separately; the original
legacy expectations are retained. Published non-polar orientation/date/cusp tests run
against the new default without changing their expected values or tolerances.

Controller tests cover both-model shares/tours/previews, coexistence, legacy house-system
changes, and no record/selection/clock/presentation changes on unavailable geometry.
The bounded isolated browser test covers visible model labels, mixed-model report refusal,
new-model report output and actual form submission of an unavailable case.

These checks are regressions and geometric evidence, not a substitute for independently
sourced polar UTC/location ASC/MC/cusp fixtures. High-latitude cautions remain visible,
and **A1 remains open**. The next validation slice should supply those independent
references and record their conventions and preselected tolerances.

Follow-up: the [published 78N behavior check](astroeye-polar-reference-behavior.md)
adds independent rounded-range and motion evidence. It does not supply the missing
precise UTC/location ASC/MC/cusp fixtures or close A1.

### Checkpoint verification — 2026-09-13

All **261 platform tests** passed (25.97 seconds). The isolated angle-caution/model
browser check passed within its 60-second watchdog using synthetic records; it did
not inspect or modify the user's open preview. The production build passed (238
modules, 12.28 seconds), retaining existing node:fs externalization and bundle-size
warnings. No full rendered-globe/Director walkthrough or inherited all-suite release
certification was performed.
