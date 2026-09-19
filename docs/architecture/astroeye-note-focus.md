# Research editor async focus recovery

September 16, 2026, checkpoint 104, from `ecae6d7`.

Both research editors disable their controls while awaiting service operations.
Previously the focused control could lose focus to the document body, with no
restoration. New event-note creation also unconditionally focused the editor
after its awaited source check, even if the user had since moved elsewhere.

## Policy

Capture the origin before disabling controls. After the operation and re-render,
restore it if still enabled, visible and connected. Otherwise use an enabled
editor, event-note list or reload control. New-note success prefers its editor.
Failures retain the initiating control when available, enabling a keyboard retry.

Any subsequent keydown, pointerdown or focus on another element relinquishes the
pending restoration. Browser blur to body while a control is disabled does not.
Hidden documents, hidden/inert ancestors, missing layout rectangles, invisible,
disabled, detached or removed controls cannot receive restored focus. Automatic
loads initiated outside the panel install no listeners and do not move focus.
Listeners are removed on completion, editor destruction or event-note suspension;
completion after cancellation is a no-op. Focus restoration happens only after
controls are re-enabled. No timers, service calls, records or chart/camera mutations
are introduced by the shared helper.

## Verification

- Eleven focused tests pass (0.250 seconds), covering enabled origins, fallback
  order, preferred new-note editor, later user input/focus, browser blur, hidden
  and removed targets, cancellation and production lifecycle wiring.
- All 521 platform tests pass (25.408 seconds); zero failures/cancellations/skips.
- Production build passes (260 modules, 12.06 seconds), retaining existing node:fs
  externalization and chunk-size warnings. Full repository/allocation suites were
  not rerun for this bounded panel change.
- The development-only fixture at
  `/scripts/fixtures/astroeye-note-focus.html` mounts the actual editor modules
  with synthetic memory-only service doubles. It has no main-app bootstrap,
  saved-data access or providers; downloads are disabled. Its discard/delete
  confirmation double accepts only synthetic fixture operations, not user data.
- Embedded-browser keyboard checks verify notebook save -> editor and reload ->
  Reload; new event note -> editor; event-note save -> editor; delete -> saved-note
  selector; undo -> editor. A synthetic failed notebook save preserves its draft
  and returns focus to the enabled Save button.
- With source lookup held, moving to Release and completing the operation does
  not pull focus back to the editor. Suspending event notes while lookup is held
  keeps the panel hidden and leaves focus outside when released. Unit tests
  separately cover suspension cancellation and hidden-target guards.
- The editors were disposed through the fixture's control, clearing unsaved
  leave guards, then the temporary tab was closed. The original globe tab and
  user notes were untouched. The fixture uses in-memory data, not real IndexedDB
  persistence or main-workspace/Director composition, so it does not certify those.

For reproduction, start the dev server and open the fixture in a disposable tab.
Use Enter on Save/Reload/New/Delete/Undo, then Hold/Fail/Suspend to inspect delayed
and failed outcomes. Use Dispose test panels before closing a dirty fixture.
Reload resets synthetic data. The fixture is under scripts, not public, and is
not a production route.

Five release gates remain accepted and ten open. This advances U2 keyboard
coverage; it does not verify audible screen-reader behavior or close R2/U2.
No saved-record/schema, calculation, provider or publication changes.

## Checkpoint 105 — Background and close/reopen lifecycle

September 17, 2026, from `93cad84`. A focus owner now relinquishes restoration
on window blur or a hidden-document notification, even if the user returns before
the pending operation settles. Already hidden/unfocused documents do not capture
ownership; completion also checks document focus. Window and visibility listeners
are removed alongside the existing input listeners on completion/cancellation.
This changes focus only, not whether an already-requested save is allowed to finish.

All sixteen focused tests pass (0.801 seconds), including leave-and-return,
unfocused start/completion, harmless visible notifications and permanent
cancellation. All 526 platform tests pass (56.105 seconds), with zero failures,
cancellations or skips. Production build passes (260 modules, 32.76 seconds),
with existing externalization/chunk-size warnings. Full repository/allocation
suites were not rerun. Background transitions are controlled unit-test evidence,
not a newly verified native tab-switch or OS-window interaction.

The fixture now has Close/Reopen synthetic workspace controls around both real
editors. In the actual embedded browser, a normal notebook save still restores
editor focus. A held notebook save completes while the wrapper is hidden and
reopens with its saved text and disabled clean Save button, without moving focus
from Reopen. A held failing save preserves unsaved text, exposes the error and
leaves Save enabled on reopen, again without stealing focus. A held event-note
save preserves its captured UTC time, location and synthetic text through the
same close/reopen sequence. Dispose during a held event-note reload completes
with focus on Dispose; the temporary tab was then closed.

These close/reopen checks use a synthetic wrapper and memory-only services, not
the main workspace or native IndexedDB. User notes and the original globe tab
were untouched. No records were exported, no settings or permissions changed,
and nothing was published. Five gates accepted, ten open; U2 and R2 remain open.
