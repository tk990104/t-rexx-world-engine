# AstroEye / Director workspace validation

## Checkpoint 84 — September 15, 2026

The real AstroEye tour controls now have a bounded browser regression check for
Director handoff, Stop, Escape and full three-shot completion. Application code
is unchanged; this checkpoint adds verification, not a new feature.

```sh
node scripts/qa-astroeye-provider-workspace.mjs --node-assets --director
```

The optional Director extension reuses the provider check's disposable browser,
synthetic IndexedDB records and private research fixtures. It mounts the real
workspace with the same recipe/adapter callbacks as main.js and uses the real
SceneDirector and localStorage project persistence. No user browser is attached.

Camera flights complete on the next microtask; visual application is simulated.
Real shot holds and cancellation are retained. Only the three actual playback
visibility rules are extracted from style.css; this is not full-app CSS/visual
acceptance. A minimal scene selector, status and Stop button exercise Director's
real DOM event wiring. Module loading uses the explicit test-only localhost relay;
no live provider, external feeds, microphone, credentials or user records are used.

### Verified

- Create tour appends three shots without replacing existing scenes. Every shot
  carries the selected event, house calculation inputs and -60-minute preview;
  unrelated live layers remain undeclared.
- Private note/notebook fixture text is absent from the persisted project and run
  telemetry. The private workspaces remain unchanged in the event-record backup.
- Preview hands the saved instant (2026-11-01 05:30 UTC) to the real workspace adapter.
- Playback hides the workspace under its production visibility rule, disables
  event-note access and focuses the visible Stop button.
- Clicking Stop and pressing Escape both cancel the run, restore the workspace,
  clear busy state and return keyboard focus to Preview saved tour.
- After changing the current preview to -15 minutes, complete playback restores
  the tour's frozen -60-minute instant, visits all three simulated camera poses,
  balances recording-mode entry/exit and makes no live-layer changes.
- Event/chart/private workspace bytes and saved project bytes are unchanged by
  cancellation and playback. The provider-form regression also passes in this run.

### Evidence and limits

Browser run passed on its first attempt: exit 0, all assertions passed, graceful
cleanup in 1.506 seconds, no forced termination. Cleanup began at 44.198 seconds;
the existing whole-run watchdog remains 60 seconds. No page errors, unexpected
requests or relay failures. Source syntax checks pass.

70 focused tests passed, zero failures, 16.573 seconds:

```sh
node --test src/scenes/director.test.mjs src/scenes/scenePolicy.test.mjs src/modules/astroeye/directorRecipe.test.mjs src/modules/astroeye/workspaceController.test.mjs scripts/qa-owned-browser-cleanup.test.mjs
```

These results cover the composed controller/UI workflow, not actual Cesium flights,
terrain rendering, full style transitions, main-app bootstrap or the embedded host.
The browser-loading limitation from checkpoint 82 remains unresolved. No new
full-suite/build or publication claim. U1/U2 remain open pending the remaining
actual-host/map checks; five release gates remain accepted and ten open. Next:
collection-size/performance baseline work under U3, with actual-host acceptance
tracked separately rather than implied by this simulated-camera result.
