# Module Platform Contract

Status: foundation and first AstroEye event/globe integration implemented.

T-Rexx World Engine uses a modular monolith. Product modules share the existing Cesium globe and server process, but register through explicit services rather than adding business logic to `src/ui.js` or `vite.config.js`.

## World module

Every module declares:

- stable `id`, user-facing `title`, semantic `version`, and icon
- required world capabilities
- owned layers, panels, commands, scene recipes, and credits
- optional asynchronous `start(context)` and `stop(context)` hooks
- optional `serializeState()` output with its own schema version

`ModuleRegistry` enforces unique IDs, checks required capabilities, and permits one active product module at a time. Shared layers can continue running underneath the active product module when their existing layer policy permits it.

## Shared context

The foundation currently provides:

- `EventBus` for small synchronous domain notifications
- `WorldClock` with live, event, and replay modes
- `CommandRegistry` as the future single source for UI, free voice, and OpenAI Realtime commands
- `ModuleStateCoordinator` for versioned active-module and module-owned state
- `PanelRegistry` as the only mounting seam for module panels
- `SourceRegistry` for license, attribution, and cache-policy metadata
- `ModuleRegistry` for lifecycle and active-module state
- `WorldRecordStore` for versioned IndexedDB events, charts, and research workspaces

The composition root will add the existing viewer, data manager, camera coordinator, annotations, panel host, and scene director during the next integration slice.

AstroEye event records use `src/domain/events/eventSchema.js`. A record retains its original local date/time, IANA time zone, resolved UTC instant, verified venue coordinates, participants, competition, and source. Daylight-saving gaps fail closed; folds require an explicit matching UTC choice instead of silently selecting one occurrence.

The first workspace is launched from the existing data rail and mounted through `PanelRegistry`. It supports manual entry, an explicit repeated-hour choice, saved-event selection, versioned JSON import/export, an accessible SVG zodiac/house/aspect wheel, chart summaries, and a Cesium venue marker. Selecting an event changes `WorldClock` to event mode but deliberately leaves Cesium's live-feed clock untouched.

The chart wheel is rendered from a deterministic geometry model, so zodiac, house, angle, body, retrograde, and aspect placement can be tested without relying on browser screenshots. A 20-case internal regression pack spans daylight-saving boundaries, a leap day, fractional UTC offsets, both hemispheres, and polar day/night. Its pinned values detect pipeline drift from Astronomy Engine 2.1.19. A separate [NASA/JPL Horizons comparison](astroeye-validation.md) now checks all ten bodies at 15 instants, plus motion at five central dates. External house and planetary-hour validation remains pending.

AstroEye now has an unsaved [time explorer](astroeye-time-explorer.md) and explicit [view links](astroeye-share-views.md). Links restore validated calculation inputs and preview time after the existing world-share restoration, without a second camera move or automatic record import. Shared selections use `shared: true` and `selectedChartId: null`; saving a copy creates a fresh local event ID. Event data is deliberately excluded from automatic URL updates and ordinary world-only links.

The [event sky](astroeye-event-sky.md) supplies cached Earth-fixed Sun/Moon directions to the existing celestial ring. Its time source is visibly labeled, uses the chart's UTC instant, and never changes Cesium's clock or map lighting. The ring retains ownership of rendering and the full-globe visibility gate; the module owns the opt-in override and clears it on exit.

The first calculation adapter uses Astronomy Engine under MIT. Results identify the exact engine version and reference frame. The calculation core produces tropical apparent geocentric true-ecliptic-of-date positions, Whole Sign or Equal houses, major aspects with applying/separating motion, and traditional unequal planetary hours. Placidus and other house systems remain absent until independently verified fixtures are available.

## Boundary rules

The first [AstroEye Director tour](astroeye-director-tour.md) adds three deterministic camera shots with versioned calculation inputs. Director project v4 stores module context separately from layers; product adapters validate and restore it without saving records or competing for the camera. AstroEye is the first registered scene adapter; other modules can adopt the same boundary.

- A module may depend only on capabilities it declares.
- API keys never enter module state, share links, or browser logs.
- Every provider must register terms, attribution, and a cache policy before its data is displayed.
- Reproducible time-sensitive work reads `WorldClock`; it must not call `Date.now()` directly.
- Module state and existing layer state remain separate, versioned payloads.
- Durable record imports are validated before one atomic IndexedDB transaction; invalid data cannot partially replace a workspace.
- AstroEye business logic lives under `src/modules/astroeye/`, not the core UI file.
