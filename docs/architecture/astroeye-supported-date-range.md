# AstroEye calculation date range

## Approved scope

On September 13, 2026 the user selected **1900–2100 inclusive** as the first-release
target. The app now accepts new chart calculation instants in the UTC interval
`[1900-01-01T00:00:00.000Z, 2101-01-01T00:00:00.000Z)`.
This is an application support policy, not a statement that every date has been
independently validated. A3 remains open for station, zodiac-boundary, historical-zone
and independent position samples appropriate to this range.

## One boundary contract

`calculation/dateRange.js` supplies an immutable range and a strict UTC assessment.
Statuses distinguish invalid timestamps, before-range, within-range and after-range.
Only explicit UTC timestamps with seconds and at most millisecond precision are
accepted. Invalid calendar rollovers, implicit zones, offset strings and numeric
coercions fail rather than being silently interpreted. This helper consumes canonical
UTC instants; venue-local conversion remains the existing IANA-zone resolver's job.

The first millisecond of 1900 is included; the first millisecond of 2101 is excluded.
The resolved UTC year governs, not the form's venue-local calendar year. A venue-local
January 1 in 2101 can therefore still be in range, while a local December 31 in 2100
can be out of range. The form deliberately does not use misleading local-date
min/max attributes. Its help text and resolved draft summary explain the UTC policy.

## Enforcement and preservation

- New full charts check the canonical event instant before houses/positions/hours
  are calculated, for all three existing calculation models. In-range numerical
  results, chart IDs and model versions are unchanged.
- Time previews check both the source event and the shifted instant; the existing
  six-hour preview bound still applies. Shared views check both instants too, so
  links and newly constructed Director recipes cannot bypass the range policy.
- Rejected saves and previews occur before record, selection or world-time mutation.
- Canonical event parsing, record storage, reviewed import and export are not narrowed.
  Existing out-of-range charts with a matching supported model/house system can still
  be selected and displayed from stored values, including resetting to their saved
  time. A visible archival warning explains the limitation. Nothing is migrated,
  recalculated, deleted or silently upgraded.
- Out-of-range new calculations, nonzero previews, missing-house calculations and
  view-link creation/restoration are refused, even when an older model is requested.
  Use records export/import to preserve archival data; old out-of-range links are
  not an alternative calculation path. Existing camera-only tours are not rewritten.

Low-level astronomy functions remain internal numerical primitives: their neighboring
samples can extend beyond the app interval (six-hour motion samples, multi-day solar
searches). The policy constrains chart instants, not every auxiliary solver sample.
It does not expand ephemeris claims or change the engine version or license.

## Validation scope

Six pure range tests cover explicit configuration, exact millisecond limits, invalid
input/calendar handling, representational extremes, venue-local year offsets and
preview assessment. Four integration tests cover all model versions, boundary
charts, shared previews, draft notices, refusal without writes, and archival
selection/export/import preservation. Extreme-year helper tests are representation
tests only, not a claim that those years are supported for chart calculation.

Browser checks use synthetic isolated records to exercise the actual form rejection,
range help, archival warning, warning clearing and narrow/wide layout. They never
access the user's IndexedDB records or control the user's preview.

Remaining A3 work: independently sourced endpoint/older-date positions and motions,
station and zodiac-boundary cases, historical-zone conventions, then a complete
candidate rerun. Existing sampled agreements alone do not close A3 or certify v0.1.

## Checkpoint 49 verification — September 13, 2026

All 314 platform tests passed in 21.14 seconds, including ten new range tests.
The isolated browser check passed for actual form refusal, archival-chart warning,
warning clearing, narrow/wide layout, existing model/caution behavior and synthetic
record preservation. Production build passed (241 modules, 12.56 seconds) with the
existing node:fs externalization and large-chunk warnings. The stored Horizons
comparison passed for all ten bodies without fetching or changing reference data.
