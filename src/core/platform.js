import { CommandRegistry } from './commandRegistry.js';
import { EventBus } from './eventBus.js';
import { ModuleRegistry } from './moduleRegistry.js';
import { SourceRegistry } from './sourceRegistry.js';
import { WorldClock } from './worldClock.js';

/** Creates the shared, headless services before Cesium/UI integration. */
export function createWorldPlatform({ now = Date.now, context = {} } = {}) {
  const eventBus = new EventBus();
  const commandRegistry = new CommandRegistry();
  const sourceRegistry = new SourceRegistry();
  const worldClock = new WorldClock({ now, eventBus });
  const sharedContext = { ...context, eventBus, commandRegistry, sourceRegistry, worldClock };
  const moduleRegistry = new ModuleRegistry({ context: sharedContext, eventBus });

  return Object.freeze({
    eventBus,
    commandRegistry,
    sourceRegistry,
    worldClock,
    moduleRegistry,
  });
}
