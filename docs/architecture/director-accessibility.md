# Checkpoint 99 — Director keyboard recovery and manual-load reduced motion

September 16, 2026. Baseline: `b4dc64f` (checkpoint 98).

## Actual embedded-host keyboard check

Used the existing sample scene without creating, importing, updating or deleting
scenes. An initial pre-refresh attempt moved focus to Stop but did not return it
to Start. That observation is not counted as passing. After a full preview
refresh, the explicit keyboard sequence produced:

1. Before Enter: `scene-start-btn`, enabled.
2. During playback: `scene-playback-stop`, enabled; playback CSS mode active.
3. After Escape: `scene-start-btn`, enabled; playback CSS mode inactive.

The preview was restored to its original Normal presentation, with recording and
playback off and Scenes collapsed. Sample playback briefly applied its visual
style; original view settings were restored through the preview URL and refresh.
No saved scene/event edits, exports, links or microphone actions occurred.
Natural completion and removed-origin behavior remain covered by controlled unit
tests, not by this actual-host Escape check. No screen-reader certification.

## Motion policy implemented in this checkpoint

Manual LOAD and NEXT-shot navigation sample `prefers-reduced-motion: reduce` at
the final guarded camera step. Reduced motion uses zero seconds; the default
remains 2.2 seconds and a normal caller-supplied duration still works. Invalid,
busy, denied and superseded loads do not sample the preference or start a flight.
Framing, camera ownership, module/layer restoration and saved shot data are
unchanged. NEXT uses the existing manual load route.

`src/core/motionPreference.js` now owns the shared preference reader. AstroEye
keeps its existing exported name as an alias, so venue, markers and event sky
use the same behavior without Director depending on the AstroEye module.
There are no preference listeners, persistent settings or new network requests.

The camera helper accepts explicit numeric zero instead of converting it into
its fallback animation. Its watchdog is cleared on completion/cancellation and
is not scheduled after synchronous completion. Other fallback durations and the
existing timeout margin are unchanged.

Authored START playback deliberately keeps its shot durations and holds. It does
not consult the manual-load preference. This is **not** a complete Director motion
policy: a future explicit choice must balance reduced motion with authored timing
and recording intent without silently rewriting saved tours.

## Verification

All 80 focused tests pass (6.274 seconds): preference changes, unchanged geometry
and saved project, no storage writes, invalid/busy/denied/superseded work,
unchanged authored playback, synchronous completion and watchdog cleanup, plus
existing keyboard and markup checks. Production build completes with 258 modules
in 52.08 seconds, with existing node:fs externalization and chunk-size warnings.
All 3,311 ordinary repository tests pass (215.070 seconds), with zero failures,
cancellations or skips. This used the existing runner's ordinary-test plan;
allocation probes were not rerun in this checkpoint (all 14 passed at checkpoint
98, with their code unchanged). This is not a fresh full `npm test` allocation claim.

Actual-host reduced-motion preference operation has not been changed or emulated;
zero-duration coverage is controlled-test evidence only. Five release gates remain
accepted and ten open. Next: an explicit authored-playback motion policy, broader
keyboard/assistive-technology coverage and actual-host reduced-motion validation.
Nothing published.
