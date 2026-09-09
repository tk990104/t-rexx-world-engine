# T-Rexx World Engine Baseline Audit

Audit date: 2026-09-09  
Source commit: `5804ba8811235983505b676e02e855d8986de21e`  
Local baseline tag: `upstream-uhrichsam4-5804ba8`

This file records the state of the source before T-Rexx behavior changes. It prevents later work from mistaking inherited failures or warnings for regressions introduced by AstroEye.

## Environment

- Windows
- Node.js `v24.20.0`
- npm `11.16.0`
- Declared Node range: `>=24.14.0 <25 || >=26 <27`

Dependency installation used Node's `--use-system-ca` option because the default OpenSSL chain could not verify the local network certificate. TLS verification was not disabled.

## Production build

Result: **PASS**

- Vite transformed 183 modules and completed the production build.
- Existing warnings report `node:fs` browser externalization for `neighborhoodPolygons.js` and `naturalEarthRegions.js`.
- Existing bundle-size warnings include several large geographic datasets and an application JavaScript chunk around 1.47 MB before gzip.
- The restricted workspace sandbox could not load the Vite configuration because it attempted a filesystem read above the workspace. The same untouched source built successfully in the normal local execution environment.

## Unit tests

Result: **2746 passed / 2771 total; 25 inherited failures**

The failing assertions are concentrated in existing Cockpit/UI ownership and layout contracts, CCTV lifecycle/selection contracts, tracking retry wiring, Realtime schema parity, loading lifecycle, and scene/share-state behavior. The exact failing test names from the baseline run were:

1. Cockpit takeover invalidates deferred work before camera cancellation
2. voice Cockpit entry reaches the camera only through stamping seams
3. voice Cockpit next/previous shares the manual Context navigation path
4. Cockpit Escape handling precedes form-control shortcut suppression and focus is restored
5. Cockpit shortcut failures do not leak and open Radio owns the first Escape
6. the Contact panel never hides itself out from under its own NEXT button
7. programmatic Context layer changes cannot bypass explicit expansion policy
8. share startup isolates panel defaults from recipient-local collapse preferences
9. fresh Cockpit entry temporarily collapses map panels and exit restores their exact layout
10. Cockpit panel corridors reserve the owned topline readouts
11. an expanded Cockpit left panel stays above Contact, HUD, and attribution
12. mobile Cockpit prioritizes flight instruments and collision-safe controls
13. cockpit aircraft handoff invalidates the prior world-position anchor
14. cockpit briefing cycle control keeps its state as the accessible name
15. CCTV null-active coverage, auto-hop, cycling, and panel targets stay honest
16. selection restoration uses the same key the cards and focus use
17. production eviction sites actually tag their clears
18. the retry is wired to every lifecycle edge, not just declared
19. both layers gate the tracked-model load and record its failures
20. the voice TOOL SCHEMA is byte-identical to main — the mission mapping is instructions only
21. the loading ticker never runs hidden and stops after loading and notices settle
22. any other camera destination clears the search label too
23. lifecycle is idempotent and teardown removes listeners, observers, and DOM
24. detection-on-by-default is a default, not an operator override
25. applyVisualState gates the map-stack switch on both sides of its await

These failures are baseline debt. AstroEye changes must not increase the failure count. Repair should be isolated from the module-platform work unless a failing contract blocks that work.

## Dependency audit

Result: **9 high-severity advisories, 0 critical**

The inherited advisory set includes:

- Puppeteer / `@puppeteer/browsers` / `extract-zip`
- Sharp / bundled image libraries
- transitive `ip-address`, `js-yaml`, `nanoid`, and `postcss`

Some fixes are major-version updates. Do not apply `npm audit fix --force`. Upgrade and verify each direct dependency deliberately, beginning with tools that process untrusted archives or images.

## Baseline policy

- Keep this audit unchanged except to append dated re-audit sections.
- Run focused tests for every T-Rexx change and the full suite at milestone gates.
- Treat 25 as the maximum inherited-failure budget; no new failures may be accepted.
- Do not suppress security advisories or weaken TLS verification.
