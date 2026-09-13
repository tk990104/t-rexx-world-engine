import { resolveZonedLocalTime } from '../../domain/events/eventSchema.js';
import { ASTROEYE_DATE_RANGE } from './calculation/dateRange.js';

/** Read-only description of the draft's exact start; never guesses a repeated hour. */
export function describeDraftTime({ localDate = '', localTime = '', timeZone = '', utcStart = '' } = {}) {
  if (!localDate || !localTime || !timeZone.trim()) {
    return { state: 'incomplete', text: 'Enter a local date, start time and venue time zone to check the draft start.' };
  }
  try {
    const resolution = resolveZonedLocalTime({ localDate, localTime, timeZone: timeZone.trim() });
    if (resolution.status === 'nonexistent') {
      return { state: 'nonexistent', resolution, text: 'This local time does not exist because of a clock change. Choose a different start time; no UTC start is selected.' };
    }
    const index = resolution.status === 'exact' ? 0 : resolution.candidates.indexOf(utcStart);
    if (index < 0) return { state: 'ambiguous', resolution, text: 'This local time occurs more than once. Choose a repeated-hour occurrence to see its UTC start; no occurrence is guessed.' };
    const instant = resolution.candidates[index];
    if (ASTROEYE_DATE_RANGE.assess(instant).status !== 'within-range') {
      return { state: 'out-of-range', resolution, utcStart: instant,
        text: `Draft resolves to ${instant}, outside the supported 1900–2100 UTC calculation range. Choose another time; no records have been changed.` };
    }
    const offsetSeconds = (Date.parse(`${resolution.localDate}T${resolution.localTime}Z`) - Date.parse(instant)) / 1000;
    const absolute = Math.abs(offsetSeconds);
    const two = (value) => String(value).padStart(2, '0');
    const offset = `${offsetSeconds < 0 ? '-' : '+'}${two(Math.floor(absolute / 3600))}:${two(Math.floor(absolute / 60) % 60)}${absolute % 60 ? `:${two(absolute % 60)}` : ''}`;
    const occurrence = resolution.status === 'ambiguous' ? `${index === 0 ? 'First' : 'Second'} occurrence. ` : '';
    return { state: 'ready', resolution, utcStart: instant,
      text: `${occurrence}Draft start: ${resolution.localDate} ${resolution.localTime} (${resolution.timeZone}, UTC${offset}) → ${instant.replace('T', ' ').replace('.000Z', ' UTC')}. Draft preview only.` };
  } catch (error) {
    return { state: 'invalid', text: `Cannot resolve the draft start: ${error.message}` };
  }
}
