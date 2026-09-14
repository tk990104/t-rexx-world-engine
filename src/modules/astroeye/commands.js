import { TIME_EXPLORER_LIMIT_MINUTES } from './timeExplorer.js';
import { requireSupportedChartCalculation } from './calculation/modelVersion.js';

const names = ['open', 'close', 'select_event', 'fly_to_venue', 'preview_time', 'event_sky', 'summarize'];
export const ASTROEYE_COMMAND_NAMES = Object.freeze(names.map((name) => `astroeye_${name}`));
const textKey = (value) => value.normalize('NFC').trim().toLowerCase();
const reply = (code, details = {}) => Object.freeze({ ok: code === 'ok', code, ...details });
function freezeTree(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freezeTree); Object.freeze(value); }
  return value;
}
const schema = (properties = {}) => freezeTree({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const SPECS = [
  ['open', 'Open the AstroEye workspace.', schema()],
  ['close', 'Close only the AstroEye workspace.', schema()],
  ['select_event', 'Select one locally saved event by exact title. Ambiguous titles require manual selection. Does not save a chart or move the camera.', schema({ title: { type: 'string', minLength: 1, maxLength: 200 } })],
  ['fly_to_venue', 'Fly to the selected event venue only when camera ownership allows it.', schema()],
  ['preview_time', 'Preview an absolute whole-minute offset from event start; zero restores the original chart. Never changes saved records.', schema({ offsetMinutes: { type: 'integer', minimum: -TIME_EXPLORER_LIMIT_MINUTES, maximum: TIME_EXPLORER_LIMIT_MINUTES } })],
  ['event_sky', 'Explicitly enable or disable the selected event sky without moving the camera.', schema({ enabled: { type: 'boolean' } })],
  ['summarize', 'Describe only the displayed calculation time, model and conventions. No predictions, saved collection, notebook, title or coordinates.', schema()],
];

function validate(args, properties) {
  if (!args || typeof args !== 'object' || Array.isArray(args)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(args))) return false;
  const keys = Reflect.ownKeys(args), expected = Object.keys(properties);
  if (keys.length !== expected.length || keys.some((k) => !expected.includes(k))) return false;
  return expected.every((key) => {
    const d = Object.getOwnPropertyDescriptor(args, key), rule = properties[key];
    if (!d || !Object.hasOwn(d, 'value')) return false;
    const v = d.value;
    if (rule.type === 'string') return typeof v === 'string' && v.trim().length > 0 && v.length <= 200 && !/[\u0000-\u001f\u007f]/u.test(v);
    if (rule.type === 'integer') return Number.isInteger(v) && v >= rule.minimum && v <= rule.maximum;
    return typeof v === 'boolean';
  });
}

/** Transport-independent contract. Shell adapters must honor isCurrent before
 * committing async effects, and own UI refresh/camera arbitration. No network,
 * microphone, writes, or automatic registration in a remote tool catalog here. */
export function createAstroEyeCommands(services, { timeoutMs = 5000 } = {}) {
  const required = ['canInteract', 'getSnapshot', 'listEvents', 'selectEvent', 'openWorkspace', 'closeWorkspace', 'flyToVenue', 'previewTime', 'setEventSky'];
  if (!services || required.some((key) => typeof services[key] !== 'function')) throw new TypeError('AstroEye command adapters are incomplete');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 5000) throw new RangeError('Command timeout must be 1–5000 ms');
  let busy = false, disposed = false;
  let cancelActive = null;

  async function execute(action, parameters, args, context = {}) {
    if (!validate(args, parameters.properties)) return reply('invalid_arguments');
    // Capture validated primitives before yielding; caller mutation cannot retarget work.
    args = { ...args };
    if (disposed || context.signal?.aborted) return reply('cancelled');
    if (busy) return reply('busy');
    let interactionVersion;
    try {
      if (services.canStart && services.canStart() !== true) return reply('blocked');
      interactionVersion = services.getInteractionVersion?.();
    } catch { return reply('blocked'); }
    busy = true;
    let live = true, timer, onAbort;
    const isCurrent = () => live && !disposed && !context.signal?.aborted && services.canInteract() === true
      && interactionVersion === services.getInteractionVersion?.();
    const guard = () => { if (!isCurrent()) throw new Error('Command no longer owns interaction'); };
    const run = async () => {
      guard();
      if (action === 'select_event') {
        const events = await services.listEvents(); guard();
        if (!Array.isArray(events)) return reply('failed');
        const matches = events.filter((event) => typeof event?.title === 'string' && textKey(event.title) === textKey(args.title));
        if (!matches.length) return reply('not_found');
        if (matches.length !== 1) return reply('ambiguous');
        if (typeof matches[0].id !== 'string' || !matches[0].id) return reply('failed');
        const result = await services.selectEvent(matches[0].id, { navigate: false, persistChart: false, isCurrent });
        guard(); return result ? reply('ok') : reply('failed');
      }
      if (action === 'open' || action === 'close') {
        const result = await services[action === 'open' ? 'openWorkspace' : 'closeWorkspace']({ isCurrent });
        guard(); return result === true ? reply('ok') : reply('failed');
      }
      const selection = services.getSnapshot();
      // Turning the sky off is also useful when no chart remains selected.
      if (!selection && !(action === 'event_sky' && !args.enabled)) return reply('no_selection');
      if (action === 'summarize') {
        const chart = selection.chart, model = requireSupportedChartCalculation(chart);
        if (!['equal', 'whole-sign'].includes(chart.options.houseSystem)) return reply('failed');
        return reply('ok', { calculation: Object.freeze({
          calculatedFor: new Date(chart.calculatedFor).toISOString(), calculationVersion: model,
          zodiac: 'tropical', houseSystem: chart.options.houseSystem,
          referenceFrame: 'apparent-geocentric-true-ecliptic-of-date',
          notice: 'Descriptive calculation only. Existing accuracy and time-policy cautions still apply; no outcome prediction.',
        }) });
      }
      let result;
      if (action === 'fly_to_venue') result = await services.flyToVenue({ isCurrent });
      if (action === 'preview_time') result = await services.previewTime(args.offsetMinutes, { isCurrent });
      if (action === 'event_sky') result = await services.setEventSky(args.enabled, { focus: false, isCurrent });
      guard(); return result === true ? reply('ok') : reply('failed');
    };
    try {
      if (!isCurrent()) return reply('blocked');
      const cancellation = new Promise((resolve) => {
        onAbort = () => { live = false; resolve(reply('cancelled')); };
        cancelActive = onAbort;
        context.signal?.addEventListener('abort', onAbort, { once: true });
        timer = setTimeout(() => { live = false; resolve(reply('timeout')); }, timeoutMs);
      });
      // Consume late failures too; never echo provider/event/error text to a model.
      return await Promise.race([run().catch(() => reply(isCurrent() ? 'failed' : 'cancelled')), cancellation]);
    } catch { return reply('failed'); }
    finally {
      live = false; busy = false; cancelActive = null;
      clearTimeout(timer); context.signal?.removeEventListener('abort', onAbort);
    }
  }
  const definitions = Object.freeze(SPECS.map(([action, description, parameters]) => Object.freeze({
    name: `astroeye_${action}`, owner: 'astroeye', description, parameters,
    safeForLocalVoice: true, mutatesWorldState: action !== 'summarize',
    execute: (args = {}, context = {}) => execute(action, parameters, args, context),
  })));
  return Object.freeze({ definitions, dispose() { disposed = true; cancelActive?.(); } });
}
