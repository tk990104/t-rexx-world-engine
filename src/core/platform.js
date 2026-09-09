import { CommandRegistry } from './commandRegistry.js';
import { EventBus } from './eventBus.js';
import { ModuleRegistry } from './moduleRegistry.js';
import { ModuleStateCoordinator } from './moduleState.js';
import { PanelRegistry } from './panelRegistry.js';
import { SourceRegistry } from './sourceRegistry.js';
import { WorldClock } from './worldClock.js';

/** Creates the shared, headless services before Cesium/UI integration. */
export function createWorldPlatform({ now = Date.now, context = {}, recordStore = null } = {}) {
  const eventBus = new EventBus();
  const commandRegistry = new CommandRegistry();
  const sourceRegistry = new SourceRegistry();
  const worldClock = new WorldClock({ now, eventBus });
  const moduleState = new ModuleStateCoordinator({ eventBus });
  const panelRegistry = new PanelRegistry({ eventBus });
  const sharedContext = {
    ...context,
    eventBus,
    commandRegistry,
    sourceRegistry,
    worldClock,
    moduleState,
    panelRegistry,
    recordStore,
  };
  const moduleRegistry = new ModuleRegistry({ context: sharedContext, eventBus });

  return Object.freeze({
    eventBus,
    commandRegistry,
    sourceRegistry,
    worldClock,
    moduleState,
    panelRegistry,
    recordStore,
    moduleRegistry,
  });
}
