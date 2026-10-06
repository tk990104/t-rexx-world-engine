# AstroEye usability and accessibility acceptance

October 6, 2026 — checkpoint 144. **U2 is accepted** for the user-approved
personal-local, standalone Chromium target. Nine release checks are accepted;
six remain open. This is engineering acceptance of the existing U2 criterion,
not a WCAG certification, screen-reader speech certification or whole release.

## Candidate and corrections

Based on `60709b2`, with two small runtime fixes in this checkpoint:

- Global voice push-to-talk no longer takes Space from native buttons, summary,
  links or ARIA widgets. Text-entry protection remains, and the dedicated mic
  keeps its documented hold-Space behavior. No microphone/provider call is needed
  to test this guard.
- AstroEye controls have a consistent cyan keyboard focus ring. Native date/time
  segment focus uses `input:focus-within`: Chromium's internal date segments can
  leave the host's `:focus` and `:focus-visible` false while `:focus-within` is true.

Final production `dist/index.html` SHA-256:
`5f55375f0bc05ec2e7976154a169372902151a036a4f743551e90a8b0779eca1`.
Windows / headless standalone Chromium `145.0.7632.77`. The existing production
runner now delegates U2 checks to `scripts/qa-astroeye-full-app-accessibility.mjs`.
Each check uses a fresh synthetic profile and imports the same synthetic backup
through the real review/confirmation UI. The actual app, styles, IndexedDB,
Director and Cesium are retained. Provider requests and microphone use are blocked.
The status fixture reports Realtime configured solely to keep the real global
shortcut installed; it is not a provider authentication or availability result.

## Criterion-to-evidence review

| U2 criterion | Accepted evidence |
| --- | --- |
| Keyboard navigation and focus | Open Data layers and AstroEye with keyboard activation. Native Space collapses the focused Quick start summary without starting voice. Enter activates all five shortcuts. Tab reaches form fields, date/time segments, comparison and note controls, with a visible outline or focus shadow; it can leave the non-modal workspace. Reverse Tab clears the sticky header/navigation. Escape closes AstroEye and restores the visible launcher. Records remain exact. |
| Labels and status announcements | Chromium's accessibility tree exposes names/roles for five shortcuts, date/time/zone fields, both note textareas and the chart image. Time-preview status is exposed as a polite live status with the changed text; Director status has the same live role. This checks the browser accessibility interface, not spoken output from an OS screen reader. Reuses detailed date/DST/range and operation-focus coverage from the linked prior evidence. |
| Narrow and wide layouts | Separate full-app runs at 390×844 and 1280×900 pass the keyboard sweep, bounds and horizontal-overflow checks. Saved screenshots were visually inspected: focused note selector is visible, the narrow sticky header is clear, and the panel stays within the viewport. This is desktop viewport emulation, not a mobile-device certification. |
| Reduced motion | Browser media emulation of `prefers-reduced-motion: reduce`, without changing Windows settings. Observational wrappers forward every original camera call: venue Refocus, event-sky navigation and actual Director preview all use zero-duration camera transitions. Escape stops Director and restores Preview focus; project and records remain exact. Reuses existing planned-duration tests; this run does not claim a new complete-tour timing benchmark. |
| First-use guide / discoverability | Existing Quick start guide identifies Compare charts, Saved events and Research notes. All corresponding shortcuts plus Event notes focus their intended sections in both layouts. No additional feature scope was added. |
| Host download / leave warning | Real browser draft-text download equals the synthetic unsaved notebook and does not save it. A native `beforeunload` dialog appears on document navigation; cancel retains the draft. Explicit Save persists it and removes the leave warning. The core workflow also reruns actual comparison/backup/matching-export downloads and reviewed import/delete/Undo. |

Supporting evidence retained, not relabeled as new full-app tests:
[Quick start](astroeye-quick-start-validation.md),
[responsive/focus behavior](astroeye-responsive-host.md),
[draft time accessibility](astroeye-draft-time-accessibility.md),
[Director accessibility and timing](director-accessibility.md),
and [U1 workflow](astroeye-full-workflow-acceptance.md).

## Final passing runs

Local ignored evidence: `qa-shots/astroeye-full-app-workflow/session-VgZTGW/`.
All five final phases exit 0, have no page errors and close their owned browsers
gracefully without forced termination. No personal browser profile was opened.

| Phase | Result | Graceful cleanup |
| --- | --- | --- |
| `workflow` | Save/comparison/notes, real downloads and deletion/import recovery pass | 1.679 s |
| `keyboard-wide` | Keyboard, focus, labels, live status and layout pass | 1.723 s |
| `keyboard-narrow` | Same checks at 390 px pass | 1.503 s |
| `leave-warning` | Native download, cancel-leave and save-then-leave pass | 2.561 s |
| `reduced-motion` | Real zero-duration navigation and Director cancellation/focus pass | 2.910 s |

Reproduce from a current production build by running `--phase=workflow` first,
then each other phase with its returned `--session=session-...`. The runner rejects
a different build fingerprint. Keep runs sequential and retain the 60-second cap.

All **172 focused tests** pass (final rerun 29.554 s): `gevRealtime.test.mjs`,
`workspaceLayout.test.mjs`, `panelOperationFocus.test.mjs`, and
`motionPreference.test.mjs`. Final production build passes: 263 modules, 26.42 s.
Existing node:fs browser-externalization and large-chunk warnings remain.
No new full-suite/allocation or hosted-CI result is claimed; hosted L1 evidence
still belongs to `eb1a716`.

## Failed attempts and boundaries

Early runs are not acceptance evidence. They exposed the Space interception and
date-segment ring gaps. Harness corrections used a same-session DOM node for the
accessibility-tree query, retained the global shortcut instead of triggering the
offline voice fallback, and opened the real visible launcher for focus-return
testing. Some startup attempts timed out; some functional passes failed the
existing browser-close limit and were not accepted. No timeout budgets were
increased. A later read-only process check found no leftover `trexx-flow-` browser
processes, and every final phase reports graceful owned-process exit.

Embedded-preview automation remains unavailable/unverified; the user explicitly
selected standalone Chromium as the acceptance target. Actual OS screen-reader
speech, native OS file-picker interaction, crash/forced-close recovery, mobile
hardware and live voice remain unverified. Browser download events/files and
native beforeunload behavior are not claims about those separate capabilities.

The API-key safety skill was applied because the shortcut fix touches the voice
controller: existing-key authorization was reused, only configuration presence
was checked, and the key was neither displayed nor changed. No live provider,
microphone, personal records, push, tag or deployment was used.

Next: **U3 performance and regression**. Remaining release checks are A1, A2,
V3, U3, L2 and L3; no other gate is waived by U2 acceptance.
