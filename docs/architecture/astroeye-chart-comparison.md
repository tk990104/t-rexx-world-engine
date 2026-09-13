# Pin and compare chart positions

Use the **Compare charts** shortcut directly below AstroEye's header. The shortcut bar stays visible while scrolling and also offers **Saved events**. With an open event chart, Compare charts scrolls to and focuses the comparison section; without one, it focuses instructions explaining how to save/select an event first. It never automatically pins or selects a chart. Saved events jumps to the list heading without changing the current selection. Either shortcut expands a compact Event sky panel like Full chart, without switching off event sky or changing globe state.

The navigation regression checks empty guidance, focused destinations below the sticky bar, compact-panel expansion, 390/1280 px layouts and unchanged stored records, selection and pin state. It runs inside the existing isolated browser check with its 60-second watchdog.

Navigation checkpoint verification: production build passed with existing warnings. The first browser run completed assertions but exceeded its watchdog during cleanup; one retry without a concurrent build passed, including cleanup, under the unchanged limit. No live-globe or full inherited release-suite run was performed.

Open a chart and use **Chart comparison → Pin this chart**. Then choose another saved event or move the time explorer. The pinned snapshot retains its exact chart time, including an unsaved preview offset. **Replace pinned chart** captures the newly displayed chart; **Clear pinned chart** removes the snapshot and returns keyboard focus to Pin.

The table compares Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto, Ascendant and Midheaven. Each row shows pinned longitude, current longitude and shortest unsigned angular separation from 0 to 180 degrees. Display precision is two decimal places; calculations are not rounded before subtraction. Missing or invalid values display Unavailable rather than zero.

Both labels include event title, exact UTC chart time, house system, engine/version, zodiac and reference frame. If engine ID/version, zodiac or frame differ, numeric comparison is hidden with a warning. Different house systems retain longitude comparison but explicitly warn that house assignments are not being compared. The table is not a cross-chart aspect interpretation, sports forecast or evidence of astrological effects.

## Session and ownership boundaries

One pin is held privately by `chartComparisonPanel.js`, using immutable field-only snapshots from `chartComparison.js`. It survives panel close/reopen and event/time changes, but is cleared on page reload or panel destruction. Editing, deleting or importing the source record does not update the snapshot; its label deliberately says Pinned snapshot. If no chart is selected, the outer chart area hides the comparison until another chart is opened.

Pins are not persisted or included in record exports, share links, annotations or Director projects. The panel has no storage, clock, camera or network capabilities. Pin/replace/clear do not calculate charts or change selection. Selecting events and exploring time continue through their existing paths, with their existing side effects (for example, calculating a missing house-system chart on normal selection).

**Download comparison report (.txt)** explicitly downloads the two displayed snapshots and their comparison values. This separate human-readable report is not an importable event backup and does not persist the pin in the app. See [comparison report notes](astroeye-comparison-report.md) for its format, privacy boundaries and verification.

**Show cross-chart aspects** adds an optional bounded view of pinned-to-current point pairs using the existing major-aspect thresholds. It includes same-named points, skips missing values and does not infer applying/separating motion across snapshot times. Clearing the pin resets this option; reloading also clears it. See [cross-chart aspect notes](astroeye-cross-chart-aspects.md).

The workspace only mounts the panel, supplies displayed event/chart updates, clears its current chart on deletion and destroys it on teardown. Provider titles and metadata are rendered as plain text. No API, dependency, database migration or provider credentials are added.

## Bounded verification

28 targeted comparison and workspace-controller tests passed. They cover immutable snapshots, exact preview time, zero-boundary wraparound, antipodes, identical angles, missing/non-finite/out-of-range values, convention mismatch refusal, house-system warnings and invalid metadata/time rejection.

The production build passed with existing externalization/bundle-size warnings. The DOM-only browser check passed within its 60-second watchdog using isolated IndexedDB and synthetic charts. It verified 12 rows, zero self-comparison, a fixed pin across time/event changes and panel close, replace/clear, mobile width, keyboard focus and no record/selection changes from pinning. Existing import/template/time-summary/deletion recovery checks also passed. No full 3D globe or live-provider test was started.
