import { createAstroEyeCommands } from './commands.js';

/** Registers local shell commands; transport exposure remains separately opt-in. */
export function installAstroEyeWorkspaceCommands({ registry, controller, workspace, panels, host, canInteract, flyToVenue }) {
  if (!registry?.register || !registry?.unregister || !panels?.show || !panels?.hide
    || typeof canInteract !== 'function' || typeof flyToVenue !== 'function') throw new TypeError('Missing AstroEye shell command services');
  const mark = () => workspace.markCommandInteraction();
  const commands = createAstroEyeCommands({
    canInteract,
    canStart: () => !workspace.isBusy(),
    getInteractionVersion: workspace.interactionVersion,
    getSnapshot: controller.selectionSnapshot,
    listEvents: controller.listEvents,
    async openWorkspace({ isCurrent }) {
      if (!isCurrent()) return false;
      mark();
      const panel = await panels.show('astroeye-workspace', host, { isCurrent });
      return Boolean(panel && isCurrent() && !workspace.root.hidden);
    },
    async closeWorkspace({ isCurrent }) {
      if (!isCurrent()) return false;
      mark();
      // Do not close another module or venue-context panel.
      if (panels.activePanelId !== 'astroeye-workspace') return workspace.root.hidden;
      await panels.hide(); return isCurrent() && workspace.root.hidden;
    },
    async selectEvent(id, options) {
      if (!options.isCurrent()) return false;
      mark(); return workspace.selectSavedEvent(id, options);
    },
    previewTime(minutes, options) { mark(); return workspace.previewCommandTime(minutes, options); },
    setEventSky(enabled, options) { mark(); return workspace.setCommandSky(enabled, options); },
    flyToVenue(options) { mark(); return flyToVenue(options); },
  });
  if (commands.definitions.some((d) => registry.get(d.name))) throw new Error('AstroEye commands are already registered');
  const registrations = [];
  try { for (const definition of commands.definitions) registrations.push(registry.register(definition)); }
  catch (error) {
    commands.dispose(); registrations.forEach((r) => registry.unregister(r.name, r)); throw error;
  }
  return Object.freeze({ dispose() {
    commands.dispose(); registrations.forEach((r) => registry.unregister(r.name, r));
  } });
}
