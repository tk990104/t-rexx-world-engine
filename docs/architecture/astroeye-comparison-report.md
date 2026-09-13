# Downloadable chart comparison report

After pinning a chart and opening a compatible current chart, use **Download comparison report (.txt)**. The browser receives a UTF-8 plain-text file named `t-rexx-chart-comparison.txt`. The control is disabled when there is no valid comparison. Download failure is reported inline; successful dispatch says download requested, not that the file has been saved.

## Contents and boundaries

Report format 3 includes both event titles, exact UTC chart times, engine/version, zodiac, reference frame, house systems and all 12 displayed longitude-comparison rows. Times reflect the captured charts, including unsaved time-explorer previews. Values use the table's two-decimal display precision; shortest unsigned separation is calculated before rounding. Missing values say Unavailable, not zero. Free-text titles and settings are quoted and line breaks escaped.

The optional cross-chart aspect section is included only when **Show cross-chart aspects** is enabled. It contains the same filtered matches as the UI, active aspect type/maximum-orb filters, shown/total counts, threshold definitions, valid/skipped pair counts, ordering rule and the warning that no applying/separating phase is inferred. Otherwise the report explicitly says aspects were not included and omits filter settings. Format 1/2 reports remain readable plain text; no version is importable. See [cross-chart aspect notes](astroeye-cross-chart-aspects.md) for the newer checkpoint's verification.

The serializer reuses `compareCharts`: engine/version, zodiac or frame mismatches refuse export; differing house systems retain their warning. It accepts only the two captured snapshots and selects report fields explicitly. There are no storage reads or writes, recalculations, selection changes, camera actions, uploads, new providers or dependencies. Saved-event collections, research workspaces, venue-coordinate fields and camera state are excluded. User-entered event titles may themselves contain private details; review the report before sharing.

This is a human-readable research aid, not an importable JSON event backup, sports prediction or evidence of astrological effects. Downloading does not persist or change the session-only pin. The download adapter creates a local Blob URL and revokes it after dispatch.

## Bounded verification

32 targeted report, comparison and workspace-controller tests passed. Report checks cover exact UTC times, all rows, angular wraparound, missing values, compatibility refusal, house-system warnings, quoted multiline titles, deterministic serialization, immutable inputs and exclusion of extra supplied fields.

The isolated DOM-only browser check passed within its 60-second watchdog. It captured the download callback to verify report contents, disabled controls and unchanged stored records, selection and pin. It also reran existing import, template, time-summary and deletion-recovery checks. This verifies the UI dispatch and payload, not the native browser download dialog or a file saved to disk. No full 3D globe or live-provider test was started.

The production build passed with the existing externalization and bundle-size warnings.
