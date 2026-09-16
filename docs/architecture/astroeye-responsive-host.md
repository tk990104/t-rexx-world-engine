# Narrow embedded-host layout — checkpoint 94

September 15 local / September 16 UTC, 2026. This is a bounded responsive-layout
improvement and actual-host check, not complete U2 accessibility acceptance.

## Behavior

At viewport widths of 720 CSS pixels or less, an open AstroEye workspace temporarily
removes the left and right map rails from layout using a CSS `:has` rule. Closing
or hiding the workspace restores them automatically; wider viewports retain them.
This does not toggle layers, change feed subscriptions, or write panel preferences.
Voice controls are not hidden by this rule. Saved data is untouched.

The narrow full workspace keeps its header/44-pixel Close button sticky while its
wrapped shortcut buttons scroll normally. `stickyWorkspaceInset` measures the
toolbar that is actually sticky, so shortcut targets land below the header at
narrow widths and below navigation at desktop widths. Compact mode has no sticky
toolbar. Missing DOM/style access safely contributes zero inset.

Narrow compact event sky uses 12-pixel side margins, a 70-pixel bottom offset and a
maximum height of the smaller of 430 pixels or viewport height minus 100 pixels.
The previous desktop compact width/height remains unchanged. Form grid tracks and
labels can shrink; the existing single-column phone breakpoint is preserved.

## Actual embedded-browser evidence

The current tab was tested through its normal browser controls and read-only DOM
geometry. Temporary viewport overrides were reset at the end. No raw application
state, saved database, credentials, microphone or third-party account was accessed.
The app's ordinary saved-event list and existing map feeds remained in use.

| Viewport | Result |
| --- | --- |
| Actual 566 × 912 | Saved-events shortcut focuses its heading at y=119.78, below header bottom y=109.19. Panel client/scroll widths both 525; both rails hidden. Screenshot inspected. |
| 390 × 844 | Focused heading y=133.78, header bottom y=123.19. Client/scroll widths both 349; no horizontal panel overflow. Screenshot inspected. |
| 1100 × 844 | Navigation stays sticky, heading y=148.5 below nav bottom y=138. Client/scroll widths both 743. Both rails retain flex display. |
| 390 × 480, event sky | Panel bounds x=12–378, y=30–410, client/scroll widths both 349. Navigation static, rails hidden. Keyboard Tab reaches Full chart with a visible focus outline; exit controls visible in screenshot. |

Leaving event sky and keyboard-activating Close restore both rails to flex display
and return focus to the AstroEye launcher. Existing QA event selection was used for
the compact check; no save/delete/export action occurred. Navigation changed the
camera as expected; exact database-byte or camera-restoration claims are not made.

All 491 platform tests pass (39.555 seconds), including four new layout-inset unit
tests. Permission-enabled production build passes with 256 modules in 20.73 seconds;
existing node:fs browser-externalization and large-chunk warnings remain. Browser
layout checks were performed directly, not added as a repeatable browser harness.
No new full-repository-suite or screen-reader certification is claimed.

## Remaining scope

Five release gates remain accepted and ten open. U2 still needs broader keyboard,
screen-reader, reduced-motion, zoom and draft/leave-warning coverage. These checks
do not certify every chart/table/form state or an entire supported-device matrix.
U3 active-motion observations and reviewed device/collection/timing budgets remain
open. Nothing was published.

## Checkpoint 95 — Keyboard focus clears sticky overlays

September 15 local / September 16 UTC, 2026. At 390 × 480, Saved events followed
by Shift+Tab focused Create view link at y=32.78–70.78, behind the header ending
at y=123.19. The control was focused only; no link was created or shared.

`installWorkspaceFocusVisibility` now responds to focusin with a microtask checking
the latest focus before adjusting only workspace scrollTop. It reserves sticky
toolbar/status-bar heights plus eight pixels of clearance. Visible controls and
sticky controls such as Close do not scroll. Oversized sections do not jump past
their beginning. Closed, detached, removed, superseded or externally moved focus
does nothing. Destruction removes the listener and invalidates queued work. No
frame loop, camera calls, control activation, storage or network actions are added.

Actual embedded-host checks after the change:

- Narrow reverse Tab places the button at y=130.78–168.78 below the y=123.19
  header. Screenshot confirms its visible focus outline.
- Forward Tab to Clear filters leaves it at y=217.78–261.78 above the y=436 footer.
- At 1100 × 700, reverse Tab places Create view link at y=145.66 below navigation
  ending at y=138. The natural host widened during initial inspection; explicit
  viewport overrides isolated these cases and were reset afterward.

All nine layout tests pass, including five new scroll/lifecycle tests. All 496
platform tests pass (50.724 seconds). Permission-enabled production build passes
with 256 modules in 24.21 seconds, with existing node:fs externalization and chunk
warnings. No full-repository-suite or screen-reader certification is claimed.
An existing QA event was selected; no save/delete/export/share action occurred.
Five gates accepted, ten open; U2 reduced-motion/screen-reader and broader state
coverage remain pending. Nothing published.
