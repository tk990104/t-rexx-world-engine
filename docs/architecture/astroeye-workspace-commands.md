# Workspace command integration — checkpoint 61

Starting commit `e5ac831`. The seven-command foundation is now registered in the
application's shared command registry when AstroEye storage is available. The
manifest declares those names. This is local shell integration, **not microphone
or remote voice-tool exposure**; existing voice catalogs/dispatch are unchanged.

## Runtime behavior

The installer binds commands to rendered workspace methods, not just controller
state. Selection keeps the currently chosen house system, does not navigate and
does not persist a missing chart. Preview changes refresh chart text, slider,
comparison context and the cached event sky through the normal rendering path.
The sky command explicitly suppresses camera focus. Open/close use the shared
panel registry, and close never dismisses another panel.

Explicit venue flight goes through `styleManager.runImmediateNavigation`, using
the existing camera-ownership policy. Director playback blocks commands. The
selected event's coordinates are used locally and are not returned in results.
Command eligibility separates existing UI busy state from a command's own
loading state. Pointer/keyboard interaction in the workspace increments a revision
that invalidates delayed command work. Command actions count as deliberate
interaction so a delayed initial share restore cannot replace them.

Panel mounts now accept an `isCurrent` guard. A newer show/hide supersedes an old
pending mount; stale work cannot claim active-panel status. Explicitly declined
mounts remain retryable. These guards do not roll back module activation or other
effects already completed before cancellation. Adapters must still check their
guard before asynchronous UI effects.

Page teardown disposes pending commands and unregisters only the exact command
objects owned by this installation. A replacement or unrelated registration
cannot be removed by stale cleanup. Duplicate installation is refused and a
partially failed installation is unwound.

## Verification scope

Eight new unit tests cover shell/manifest registration, owned loading, blocked
interaction, manual cancellation during lookup, camera refusal, owner-only close,
duplicate installation, safe disposal and pending/declined panel mounts. The
existing command/controller test now uses the correct `databaseName` option for
its synthetic fake-IndexedDB database.

`node scripts/qa-astroeye-commands.mjs` runs in a fresh isolated Chromium profile
with synthetic records and external/API requests blocked. It checks all seven
commands, visible title/provenance/slider updates, preview-to-sky synchronization,
guarded mock navigation, manual cancellation, close/sky cleanup, disposal and
byte-identical durable records. It does not exercise a real Cesium camera or
live microphone/service. The actual application camera route is inspected and
compiled, while the browser check uses an injected ownership-aware mock.

The first sandboxed Chromium launch timed out after 15 seconds before app checks.
One permission-enabled bounded retry passed (Chrome 145.0.7632.77). The script has
a 60-second whole-run watchdog; no loop or shared-browser cleanup was used.

Final verification on Windows/Node 24.20.0:

- All 442 platform tests pass in 37.44 seconds, with no failures, skips or TODOs.
- Production build passes: 247 modules in 34.16 seconds, with existing node:fs
  externalization and large-chunk warnings. The first sandboxed build failed to
  load Vite config due to directory access; the permission-enabled run succeeded.
- The command browser check passes again after final guard changes. The existing
  angle-caution browser check also passes legacy/model-4, UTC/TT, reports/previews,
  polar/hour cautions, date-range/archive, layout and record-preservation paths.
- A silent scan of generated JS/HTML/CSS/JSON confirms the configured OpenAI key
  does not appear in the build. The env file remains ignored and unchanged.
- `git diff --check` passes. Nothing is pushed, tagged or deployed.

## Release boundary and next work

No credential was changed, no live AI request was made, and the user's preview
or real saved data was not accessed by testing. App calculation algorithms and
stored model identities remain unchanged. A1/A2 still block release; this does
not waive their evidence requirements. V1 remains open for final command-level
acceptance review, and V2/V3 remain open for voice transport parity, disclosure,
failure paths and an explicitly approved live smoke check.

Next: expose the canonical definitions and guarded dispatch through both existing
voice paths, keeping notebook/collection data out of implicit context. Do not
publish, enable microphone access or run metered live requests automatically.
