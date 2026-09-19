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

## Checkpoint 106 — Workspace save/reopen regression

September 19, 2026, from `d37d872`. The existing annotation-workspace browser
regression now mounts both production editors with the real workspace/controller
and real IndexedDB services in a disposable browser profile. Synthetic write
gates delay a requested save or fail it before persistence; no user database,
main-app bootstrap, provider or current embedded tab is used.

For both notebook and event-note edits, keyboard activation starts a held save,
closes the workspace and returns focus to its opener, then reopens before the
write settles. Success persists the draft and disables clean Save; failure keeps
the draft, old persisted text, enabled Save and status feedback. Completion keeps
the new focus destination. A keyboard retry saves the retained draft and restores
editor focus. Selection and navigation counters remain unchanged. Status roles
are asserted, not audible screen-reader announcements.

The expanded browser regression passes with graceful page/browser/process cleanup,
zero external/provider requests and no page errors. Existing chart comparison,
Director-signal suspension, real document-reload persistence, narrow layout and
opt-in marker/delete/undo/import assertions also pass. The marker viewer remains
mocked; this is not native embedded-host, terrain or full app/Director acceptance.
All 16 focused lifecycle tests pass (3.854 seconds); syntax and diff whitespace
checks pass. No runtime code changed, so production build, platform, full-repo
and allocation suites were not rerun.

The sandbox initially blocked browser launch. With launch permission, the existing
5173 preview could not serve the imported module; a separate loopback-only test
server on 5175 allowed isolation without restarting the user's preview. The first
60-second runs timed out (the diagnostic run reached document reload after the new
cases passed). The expanded suite now reports phases and has a 120-second overall
cap; the final run passes. Five gates accepted, ten open; R2/U2 remain open.
No user notes, globe view, permissions or provider settings were changed, and
nothing was published.

## Checkpoint 107 — Escape ownership and unsaved-draft recovery

September 19, 2026, from `e3f178b`. Workspace Escape now ignores already-prevented
events, active composition and legacy key-code 229 composition notifications.
An ordinary Escape is prevented and stops bubbling before the existing close
path, so ancestor bubbling shortcuts cannot also act on the same key. Other
keys and ignored Escape events retain their existing handling. No save, schema,
calculation, provider or camera behavior changes.

Six new unit tests cover the guard, one-time consumption and workspace wiring.
The isolated workspace browser regression verifies both editors: composition and
prevented-event simulations keep the workspace open; ordinary keyboard Escape
closes it and returns focus to its opener; reopening preserves the unsaved text
and event-note capture with byte-identical stored records. Handled Escape does
not reach a document bubbling listener. Native IME/popup behavior and screen-reader
speech are not certified by these controlled events. No user profile is accessed.

Verification: the first concurrent platform/browser attempt hit timeouts. A
two-worker platform rerun completed 532 tests: 531 passed, one legacy-model CLI
diagnostic hit its unchanged 15-second subprocess timeout (590.215 seconds total).
Its two matching tests then passed in isolation (3.535 seconds), including that
CLI check; this is not an all-green full-suite claim. All six new keyboard tests
passed in the platform run. No calculation limits or fixture expectations changed.
The browser rerun passed every functional assertion, including the new Escape
checks and existing save/reopen/reload/privacy checks, but returned exit 1 because
browser shutdown exceeded its 10-second cleanup limit and the owned test process
was force-stopped. The initial browser run hit the 120-second overall cap before
the new cases. No clean browser-lifecycle acceptance is claimed.

Production build passed with 261 modules (1m 36s) and existing node:fs/chunk-size
warnings after a sandbox configuration-read denial was resolved by a permitted
retry. The separate 5175 test server was stopped; the user's preview and research
were untouched. Full-repository/allocation suites were not rerun. Five release
gates remain accepted and ten open; this advances U2 without closing it.
