# Module Platform Contract

Status: foundation implemented, globe integration pending.

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

The composition root will add the existing viewer, data manager, camera coordinator, annotations, panel host, and scene director during the next integration slice.

AstroEye event records use `src/domain/events/eventSchema.js`. A record retains its original local date/time, IANA time zone, resolved UTC instant, verified venue coordinates, participants, competition, and source. Daylight-saving gaps fail closed; folds require an explicit matching UTC choice instead of silently selecting one occurrence.

## Boundary rules

- A module may depend only on capabilities it declares.
- API keys never enter module state, share links, or browser logs.
- Every provider must register terms, attribution, and a cache policy before its data is displayed.
- Reproducible time-sensitive work reads `WorldClock`; it must not call `Date.now()` directly.
- Module state and existing layer state remain separate, versioned payloads.
- AstroEye business logic lives under `src/modules/astroeye/`, not the core UI file.
