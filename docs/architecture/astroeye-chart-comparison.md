# Pin and compare chart positions

Open a chart and use **Chart comparison → Pin this chart**. Then choose another saved event or move the time explorer. The pinned snapshot retains its exact chart time, including an unsaved preview offset. **Replace pinned chart** captures the newly displayed chart; **Clear pinned chart** removes the snapshot and returns keyboard focus to Pin.

The table compares Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto, Ascendant and Midheaven. Each row shows pinned longitude, current longitude and shortest unsigned angular separation from 0 to 180 degrees. Display precision is two decimal places; calculations are not rounded before subtraction. Missing or invalid values display Unavailable rather than zero.

Both labels include event title, exact UTC chart time, house system, engine/version, zodiac and reference frame. If engine ID/version, zodiac or frame differ, numeric comparison is hidden with a warning. Different house systems retain longitude comparison but explicitly warn that house assignments are not being compared. The table is not a cross-chart aspect interpretation, sports forecast or evidence of astrological effects.

## Session and ownership boundaries

One pin is held privately by `chartComparisonPanel.js`, using immutable field-only snapshots from `chartComparison.js`. It survives panel close/reopen and event/time changes, but is cleared on page reload or panel destruction. Editing, deleting or importing the source record does not update the snapshot; its label deliberately says Pinned snapshot. If no chart is selected, the outer chart area hides the comparison until another chart is opened.

Pins are not persisted or included in record exports, share links, annotations or Director projects. The panel has no storage, clock, camera or network capabilities. Pin/replace/clear do not calculate charts or change selection. Selecting events and exploring time continue through their existing paths, with their existing side effects (for example, calculating a missing house-system chart on normal selection).

The workspace only mounts the panel, supplies displayed event/chart updates, clears its current chart on deletion and destroys it on teardown. Provider titles and metadata are rendered as plain text. No API, dependency, database migration or provider credentials are added.

## Bounded verification

28 targeted comparison and workspace-controller tests passed. They cover immutable snapshots, exact preview time, zero-boundary wraparound, antipodes, identical angles, missing/non-finite/out-of-range values, convention mismatch refusal, house-system warnings and invalid metadata/time rejection.

The production build passed with existing externalization/bundle-size warnings. The DOM-only browser check passed within its 60-second watchdog using isolated IndexedDB and synthetic charts. It verified 12 rows, zero self-comparison, a fixed pin across time/event changes and panel close, replace/clear, mobile width, keyboard focus and no record/selection changes from pinning. Existing import/template/time-summary/deletion recovery checks also passed. No full 3D globe or live-provider test was started.
