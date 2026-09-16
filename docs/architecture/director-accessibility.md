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

## Checkpoint 100 — Reduced-motion tour camera playback

September 16, 2026, from `e382591`. This supersedes checkpoint 99's temporary
exclusion of authored START playback from the motion preference policy.

After a shot's visual, layer and module restoration succeeds and cancellation is
checked, START samples the same host preference as LOAD/NEXT. Reduced motion cuts
the camera to the unchanged destination/orientation with zero flight duration.
It then uses the existing cancellable sleep for the authored flight duration plus
the authored hold. Normal motion keeps the original flight and hold. The saved
project is never rewritten, and estimated progress duration is unchanged.

The runtime caption identifies reduced motion and preserved timing. This policy
also applies to programmatic/voice START through the same entry point, without
new voice schema fields or service calls. It does not remove motion in shaders,
weather or live layers. A preference change takes effect at the next shot boundary;
there is no listener that interrupts a shot already in progress.

Timing tests cover normal, reduced and mixed-preference two-shot runs: each retains
a 6.5-second planned flight-plus-hold budget, identical saved project, and zero
storage writes. These are planned-duration checks, not wall-clock benchmarks:
data loading, rendering and the existing sleep polling can add overhead. Stop and
Escape tests drive the real sleep with a controlled clock, stop during the first
replacement dwell, and verify no second camera move or preference read occurs.
Missing/busy/denied tours and superseded manual loads preserve their guards.

All 79 focused tests pass (4.061 seconds). Production build passes with 258 modules
in 21.44 seconds, retaining the existing node:fs externalization and chunk warnings.
All 3,317 ordinary repository tests pass (157.007 seconds), with zero failures,
cancellations or skips. Allocation probes were not rerun; their last passing
checkpoint remains 98. This is not a fresh full `npm test` allocation claim.

No new actual-host reduced-motion or live voice verification is claimed. The
checkpoint 99 refreshed-host keyboard Escape observation remains the latest host
evidence; new tour-cut/timing/cancellation evidence is controlled-test coverage.
No saved records, browser/OS preferences or publication changed. Five release gates
accepted, ten open. Next: actual-host reduced-motion observation and broader U2
labels/status, keyboard and assistive-technology review.

## Checkpoint 101 — Playback announcements and focus visibility

September 16, 2026, from `90fd15c`. Director now publishes meaningful status
changes through a persistent polite, atomic status region outside the Scenes
panel. It stays in the accessibility tree while recording hides that panel.
Preparation is distinguished from running; running identifies reduced-motion
cuts when selected. Stop, completion and errors remain available after cleanup.
Identical text is deduplicated, literal titles use textContent, and progress ticks
do not announce. The Start/Stop/Next controls have descriptive accessible names,
Escape shortcut metadata and visible playback/motion guidance.

The embedded browser reproduced Escape leaving focus on the document body even
after Start had been explicitly focused. Scene buttons used transition: all,
including inherited visibility during recording-mode cleanup. Limiting scene
and shot button transitions to visual colors/opacity removes that interference
and avoids animating focus outlines. After a fresh reload, keyboard Enter started
the sample tour, its preparation status appeared in the accessibility tree, and
Escape returned focus to enabled Start with Stopped (Esc) still exposed. This is
one actual-host cancellation path, not exhaustive keyboard certification.

The original URL/view and collapsed Scenes panel were restored by navigation plus
reload, with recording and playback both false. No saved records were changed.
The browser advertises viewport and visibility controls but no motion-preference
emulation; no OS preference was changed. Actual-host reduced-motion operation and
screen-reader speech remain unverified, and U2 remains open. Five release gates
accepted, ten open. Nothing published.

Checkpoint 101 verification: all 80 focused tests pass (5.348 seconds), covering
status deduplication, literal text, quiet progress updates, mode/lifecycle/error
messages, Stop/Escape and non-animated visibility/outline rules. All 3,322 ordinary
repository tests pass (186.872 seconds), with zero failures, cancellations or
skips. Production build passes (258 modules, 55.57 seconds) with existing node:fs
externalization and chunk-size warnings. Allocation probes were not rerun; all
14 last passed at checkpoint 98. This is not a fresh full npm test allocation claim.
