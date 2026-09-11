/** Public identity and capability declaration for the first T-Rexx module. */
export const ASTROEYE_MANIFEST = Object.freeze({
  id: 'astroeye',
  title: 'AstroEye',
  version: '0.1.0',
  icon: 'planet',
  status: 'mvp',
  tagline: 'Event charts synchronized with the living Earth.',
  capabilitiesRequired: Object.freeze([
    'commandRegistry',
    'eventBus',
    'moduleState',
    'panelRegistry',
    'recordStore',
    'sourceRegistry',
    'worldClock',
  ]),
  layers: Object.freeze(['astroeye-event-marker']),
  panels: Object.freeze(['astroeye-workspace']),
  commands: Object.freeze([]),
  sceneRecipes: Object.freeze(['astroeye-event-tour']),
  credits: Object.freeze(['astronomy-engine', 'thesportsdb']),
});
