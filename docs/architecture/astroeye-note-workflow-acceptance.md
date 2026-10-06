# AstroEye event-note workflow acceptance

October 6, 2026, checkpoint 142. **R2 is accepted** for the user's selected
personal-local, standalone Chromium target. The user explicitly approved this
target while leaving the Codex/ChatGPT embedded preview unverified. This is not
permission to deploy, publish, transmit microphone audio or use a paid provider.
Seven of fifteen release checks are now accepted; eight remain open.

## Candidate and changes

Runtime is `c89ee93` plus the two narrowly scoped fixes recorded in this checkpoint:

- `researchAnnotationLayer.js`: top-anchor note timestamps 12 pixels below their
  points, separating them from the selected event's label above the same location.
  Exact-coordinate grouping, the 100-note cap and private-text exclusion remain.
- `mapStackController.js`: create the OSM credit with `showOnScreen: true` and its
  copyright link; it was previously hidden in the attribution popover.

All four final phases use the same production `dist/index.html` and bundle, not
a replacement test page. Index SHA-256:
`00812a9557e05225542adeceaf1814e235ba7a99d85d97a4ee8a51efb554a208`.
The runner refuses a changed index between phases. Records, calculations,
supported dates (1900–2100), house systems and credentials were not changed.

## Criterion-to-evidence decision

| R2 requirement | Passing evidence |
| --- | --- |
| Deliberate save/reopen/edit/delete | Production form creates a clearly synthetic event and Equal-house chart; the actual Event notes editor saves, reopens, edits, confirms deletion and restores via Undo. No personal records are used. |
| Opt-in map display | No note entities before explicit opt-in; the saved marker is visibly rendered and pickable. A fresh Chromium launch restores the note but leaves markers off. Keyboard Space shows and hides them deliberately. |
| Reload restoration and frozen capture | Separate Chromium processes reopen the same isolated native profile/origin. Exact saved note bytes survive; advancing chart preview time and editing text do not recapture event/time/coordinates. Undo restores the saved identity and text. |
| No implicit camera/chart mutation | Edit/delete/Undo and fresh-launch note interaction preserve event/chart records; camera position and orientation are compared with tight tolerances. Saved-event setup explicitly reuses the original house system and does not persist another chart. |
| Actual map integration | The complete app renders the note over OSM imagery and Re:Earth ellipsoidal terrain at synthetic 40°N, 75°W. Terrain height is -20.641076512 m in the provider's ellipsoidal frame, not a claim of sea-level elevation. Marker picking, 72 amber pixels, visible linked OSM attribution and exact record preservation pass. |
| Owner-only cleanup and bounded rendering | Current focused layer tests retain unrelated entities, refuse oversized/future collections, enforce 100 notes, group exact coordinates, cancel stale reads and keep shared/playback views private. The unchanged owner-sentinel and delete/Undo renderer evidence from checkpoint 125 remains applicable. |
| Accessible deliberate controls | Final production run uses Enter/Tab/Space for note entry and map toggling, checks focus, native labels and status semantics. Existing real-workspace keyboard, draft/focus recovery and 390px wrapping evidence is retained; the two fixes do not alter these controls. The saved-note list remains the non-map route to every note. This is not full U2 or screen-reader certification. |

Reused evidence: [record and recovery acceptance](astroeye-research-acceptance.md),
[workspace integration](astroeye-research-annotation-contract.md), and
[composed note/renderer verification](astroeye-map-workspace-validation.md).
Their historical R2-open statements are superseded only by this scoped decision.

## Final verification

- 34 focused annotation, recovery, layer, presenter and owned-browser cleanup
  tests passed (55.775 seconds).
- 15 map-controller/source-chip checks passed (29.940 seconds), including linked
  on-screen OSM attribution and provider reuse.
- Production build passed: 263 modules, 31.64 seconds. Existing `node:fs`
  browser-externalization and large-chunk warnings remain.
- Windows standalone headless Chromium `145.0.7632.77`, normal graphics,
  1024×768 viewport with reduced-motion preference; final session `session-BjlV2u`:

| Phase | Result | Graceful cleanup |
| --- | --- | ---: |
| capture | Saved, explicitly shown and picked; 74 amber pixels; private text excluded | 1.449s |
| edit | 72 visible pixels; zero after deletion; Undo/frozen fields/chart/camera checks pass | 1.557s |
| reload | Fresh process/native persistence, map-off default and keyboard checks pass | 2.318s |
| terrain | Actual terrain and imagery, note picking and visible attribution pass | 2.000s |

Every final phase exits 0 and closes only its owned browser and loopback static
server. Each has a 60-second watchdog. No full suite, allocation suite, clean
install or hosted CI rerun is claimed; hosted CI remains tied to `eb1a716`.

The first three phases block external traffic; all phases block app API/provider
and microphone use. Terrain mode alone permits HTTPS OSM raster tiles and
Re:Earth terrain, capped at 256 requests: 124 requests/responses in the passing
run. It keeps normal browser HTTP caching, uses one fixed view, and does not sweep,
prefetch or archive tiles. This addresses the visible-credit issue found against
the [OSMF tile policy](https://operations.osmfoundation.org/policies/tiles/), reviewed
October 6. It is not clearance of every provider, export or recording path (L2).

Reproduce after a production build, one phase at a time:

```text
node scripts/qa-astroeye-full-app-notes.mjs --phase=capture
node scripts/qa-astroeye-full-app-notes.mjs --phase=edit --session=<printed-session-name>
node scripts/qa-astroeye-full-app-notes.mjs --phase=reload --session=<printed-session-name>
node scripts/qa-astroeye-full-app-notes.mjs --phase=terrain --session=<printed-session-name>
```

Reports and screenshots are ignored local artifacts under
`qa-shots/astroeye-full-app-notes/session-BjlV2u/`; the synthetic native profile is
separate in OS temporary storage. Neither is committed or mixed with the user's
preview. The final terrain screenshot was visually inspected.

## Failed attempts and limitations

Earlier attempts are not passing evidence: embedded control failed before tab
access; sandbox Chromium launch was denied; an unsplit full-app test hit its
60-second watchdog; software-renderer/profile variants timed out during startup.
A later harness reopened an Equal-house event with the default house system,
creating an extra chart before note interaction; explicit original-house-system
selection corrected that harness error. The first terrain run exposed hidden
OSM credit. Final evidence above is from a new session after both runtime fixes.
No forced termination occurred in those four final phases.

This accepts R2, not the whole product: embedded preview, full Director playback,
all map providers/locations, screen readers, downloads, and broader performance
remain outside this test. Nearby distinct labels may still overlap; exact-location
grouping and the saved-note list remain available. A1, A2, V3, U1, U2, U3, L2 and
L3 remain open. Next is missing full-app U1 workflow evidence, reusing this note
result rather than repeating it. No push, deployment, feature removal, saved-data
deletion, real-key access or change occurred.
