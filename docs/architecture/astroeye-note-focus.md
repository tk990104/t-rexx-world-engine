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
