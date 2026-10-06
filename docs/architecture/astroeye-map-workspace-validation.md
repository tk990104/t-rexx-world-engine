# AstroEye composed note and renderer verification

October 5, 2026, checkpoint 125. Runtime candidate: `7368c55`.
QA-only changes; no production behavior, saved records or release scope changed.

## Passed evidence

`node scripts/qa-astroeye-map-workspace.mjs` uses a disposable Chromium profile,
normal Vite browser assets (default loopback port 5175), native isolated IndexedDB,
the real AstroEye workspace/controller/note editor, and the real Cesium annotation
layer. It blocks external and API requests and caps the whole run at 60 seconds.
The shared marker fixture accepts an injected bus/loader; its default three-note
in-memory fixture remains unchanged.

The successful run verifies:

- Saving a note leaves markers off and performs no layer collection reads until
  explicit opt-in. Showing markers does not change records or chart selection.
- The saved marker is pickable and visibly rendered: 82 amber pixels in its
  sampled region. UTC-only labels exclude private note text and markup.
- Editing, explicitly confirming deletion, and Undo use the actual editor.
  Deletion removes the marker (zero amber pixels), Undo restores picking and the
  last saved text, and camera position/orientation and event/chart records stay
  unchanged.
- Entering the playback body mode hides/disables notes; leaving it does not
  automatically expose the collection again. This is not actual Director playback.
- Layer teardown preserves an unrelated owner's entity. No render errors, page
  errors or external/API requests occurred.

The run reached its final validation phase at 13.262s and exited 0; owned-browser
cleanup was graceful in 1.051s. The first run failed at the unchanged 60-second
watchdog because the harness did not answer the editor's native deletion confirm.
Only the harness was fixed: accept the expected synthetic-note confirmation and
dismiss/report any unexpected dialog. That first run is not passing evidence.

The existing `qa-astroeye-marker-render.mjs` regression also exited 0: three picked
markers, amber pixel counts 81/82/81, zero after hiding, far-side occlusion,
coincident-note count/range, unchanged camera, and no playback auto-resume. Cleanup
was graceful in 1.389s. Both final browsers exited; the dedicated Vite server was
stopped. No full suite or build was repeated for these QA-only changes.

Generated, untracked screenshots under `qa-shots/astroeye-map-workspace/` show the
UTC-only amber marker in `shown.png` and its absence in `hidden.png`; both were
visually inspected. These deliberately show a plain reference surface, not tiles.

## Limits and remaining host check

This is a real 3D renderer against a depth-tested WGS84 reference mesh, with no
imagery or terrain. It does not bootstrap the full app, use the venue presenter,
fly the camera, run actual Director playback, test live providers, or certify the
embedded host. The embedded browser tool failed before tab access with
`failed to write kernel assets: The system cannot find the path specified. (os error 3)`.
No attempt was made to bypass that failure through another hidden host interface.

U1/R2 remain open, with five release checks accepted and ten open overall. Reuse
this passing evidence unless relevant code changes; do not rerun it in place of
the missing host review. Next, use restored browser tooling or a short manual
check on the actual preview:

1. Open a saved chart, then **AstroEye → Event notes**. Use a clearly labeled test
   note, not an existing personal note. Confirm markers remain off after saving.
2. Choose **Show note markers**, close the panel, and check the marker is visible
   at the chart's location with only its captured UTC label. Report missing or
   terrain-obscured markers; do not infer success from the count alone.
3. Reopen the test note, edit/save, then **Delete event note** and confirm only that
   test note. Confirm its marker disappears. Use **Undo last note deletion**
   without reloading; confirm it returns, with camera/chart unchanged throughout.
4. Record host/browser, map/terrain mode, observed outcomes and any errors. Do not
   treat these steps alone as acceptance of broader accessibility/performance,
   actual Director interaction or the entire release.

Back up important data first. This turn did not perform these manual steps or
modify the user's preview. Microphone/provider transmission, publication and
scope decisions still require their own authorization.
