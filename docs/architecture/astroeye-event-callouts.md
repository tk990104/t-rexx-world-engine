# AstroEye event callouts

Choose **Venue details → Add callout** to place a cyan label at the selected event's coordinates. Each label captures the displayed chart's UTC instant, including seconds, plus an optional 40-character note (otherwise the event title). Moving the time explorer does not update existing labels. Up to five AstroEye callouts can coexist; identical labels at the same location may reuse an existing mark.

These are session-only map annotations, not saved research records. They are absent from event exports, share links and Director projects, and disappear on reload. **Clear AstroEye callouts** removes only this module's labels, leaving other annotations alone. When the source event is deleted, the remaining labels are still reachable through the **AstroEye callouts** shortcut. Existing global annotation-clear actions can also clear them.

## Integration boundaries

- `eventCallouts.js` builds validated coordinate-only specifications from the controller's defensive selection snapshot. Notes and titles are rendered as plain SVG text by the existing renderer, never interpreted as HTML or commands.
- The shared annotation engine accepts an optional owner namespace for deduplication and owner-matched removal. Existing unowned voice annotations retain their behavior. Ownership is a lifecycle convention, not an authorization boundary.
- AstroEye passes `clearPrevious: false`, `flyTo: false`, `ensureVisible: false` and `footprint: false`. Adding a label does not navigate, request a geocoded place/building outline, save records or change the chart. A venue outside the current view will stay outside it; **View venue** remains the explicit navigation action.
- `persist: true` means keep until cleared within the current annotation engine, not durable storage. Rendering, overlap placement and render-governor holds stay with the existing annotation renderer. No additional render loop or per-frame chart calculation is introduced.
- Interaction is blocked during Director playback or workspace operations. Only one addition can be pending. A generation guard removes newly returned owned marks if clearing or playback invalidates an in-flight addition, without removing a pre-existing duplicate or unrelated annotation.
- The context panel uses the existing PanelRegistry and announces add/clear results through its live status region. The five-label limit is enforced in the service, not just the button.

## Verification and remaining scope

Five focused tests cover exact UTC snapshots, input validation, owner-scoped cleanup and deduplication, the limit, concurrent/pending cancellation and camera-assist suppression. The existing platform, annotation and scene suites remain part of the regression check.

`node scripts/qa-astroeye-venue.mjs --callouts` extends the isolated synthetic-event walkthrough with actual rendered label text, unchanged camera and records, frozen original time after advancing the chart, owner-only clearing, and cleanup after deleting the source event. The walkthrough also checks desktop/mobile context layout, keyboard navigation and the real venue-marker click. It waits for the explicit venue-flight animation to finish before comparing camera poses.

This completes a first M3 annotation slice, not durable Research Mode annotations, multi-event layer management or the full MVP. Persistent annotation provenance, editing and import/export require a separately versioned record design. No new provider, dependency, license or API key is introduced by this feature; existing map-provider display/export constraints still apply.

Milestone verification passed 121 platform tests plus 58 annotation/scene tests (179 focused checks), the production build, and the callout browser walkthrough with no page errors. Desktop label rendering and responsive context screenshots were inspected. These focused results do not declare the entire inherited test suite or broader release gates complete.
