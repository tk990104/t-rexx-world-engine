# Calculation model version foundation

## Current behavior — model 3

New drafts now use **calculation model 3**, with chart IDs ending in `:model-3`.
Explicit models 1/2 and untagged legacy records remain supported without migration.
Shares and tours accept all three versions and preserve the input version; missing link
versions and unsupported future versions are rejected. Comparisons still refuse
mixed models. See [stable planetary hours and compatibility](astroeye-planetary-hour-model-3.md)
and the earlier [polar correction](astroeye-polar-model-2.md).

The remainder of this document records checkpoint 39's **historical model-1 foundation**,
including its then-current test counts and prerequisites. Model 2 implements the
compatibility path; independent polar references and release gate A1 remain open.

## Purpose and current version

AstroEye's numerical model is separate from the Astronomy Engine package version.
New calculations now carry top-level `calculationVersion: 1`. Version 1 deliberately
retains existing mathematics, including [known polar limitations](astroeye-polar-caution.md).
No polar correction is claimed in this checkpoint.

`calculation/modelVersion.js` defines the current model and the compatibility checks.
An omitted chart field is interpreted as legacy v1 without rewriting that object.
Explicit null, strings, fractions, nonpositive and unsafe integers are invalid, not
legacy defaults. Generation/time-preview APIs accept only the supported version.
Chart schema, database version and v1 chart IDs remain unchanged because the math
has not changed. Adding metadata does change newly serialized chart text.

## Saved-chart and cache behavior

For the requested event time/house system, selection chooses a supported cached chart:
model 1 (tagged or legacy), the current Astronomy Engine ID/version, tropical zodiac
and the current reference frame. If matching cache entries exist but none is supported,
selection fails before camera presentation, clock/selection updates or record writes.
It does not regenerate over a conflicting stored chart ID. A supported matching entry
can be selected even when an unsupported entry also exists.

Stored records with unsupported metadata remain exportable through the existing record
store; they are not deleted or migrated. The generic storage schema still preserves
unknown model metadata, while AstroEye calculation/selection applies stricter checks.
The compatibility check is not a scientific validation of imported chart values.

Legacy charts keep their exact stored bytes through selection, time preview and link
creation. A nonzero preview uses model 1 explicitly; resetting returns the original
saved chart. An explicit save of a new event or shared copy produces a tagged chart.

## Visible and shared provenance

- Chart provenance displays the calculation model and identifies an untagged legacy chart.
- Comparison snapshots freeze the model number alongside engine/frame/zodiac metadata.
  Different or malformed model versions suppress longitude rows, cross-aspects and
  report download. Untagged snapshots compare as v1. Matching future-number snapshots
  can compare supplied values, but this does not mean the application can recalculate them.
- Comparison reports and newly appended notebook references state the model separately
  from the astronomy engine version. Existing notebook text is not changed automatically.
- Share/tour envelopes already required `calculationVersion: 1`; they now use the same
  current-version constant and propagate the selected version explicitly. Future versions
  remain rejected before restore. Existing v1 link encoding/scene conventions are unchanged.

Reports remain human-readable format 3 with an additional model-provenance line. They
are not importable chart backups. No coordinates, notes or collection records were added.

## Verification

Six new tests exercise tagged generation, legacy preservation, unsupported cache rejection,
mixed cache entries, comparison/report compatibility and share/tour refusal. They use
isolated fake IndexedDB and verify no writes, selection, clock or presentation changes
after rejection. All 233 platform tests passed on 2026-09-13.

The isolated angle-caution browser check additionally verifies tagged/legacy chart labels,
pinned/report labels and byte-unchanged records. The comparison browser check verifies
future-model refusal and recovery to the legacy model. Both passed within their existing
60-second watchdogs, using synthetic data rather than the user's open preview.

The isolated notebook regression also passed, including static reference append,
overflow refusal, save conflicts, draft downloads and unchanged records. No native
download/dialog behavior was retested. Production build verification is recorded in
the implementation checkpoint; existing externalization/bundle-size warnings remain.

## What must happen before changing the math

This foundation does not alone authorize bumping the constant. A corrected model must:

1. Have a distinct chart/cache identity; never reuse a v1 chart ID for changed numbers.
2. Define unavailable/ill-conditioned angle handling across chart UI, comparisons and exports.
3. Preserve old records and offer deliberate new calculations, not silent migrations.
4. Either retain the v1 calculation implementation for reproducible previews/links/tours,
   or explicitly refuse unsupported old contexts before any partial restore.
5. Include independent polar/boundary references and regression tests for both models.

A1 remains open. The next step is the versioned polar correction and its compatibility
path, not removal of the warning or an accuracy/release certification.
