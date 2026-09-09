const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^(\d{2}):(\d{2})(?::(\d{2}))?$/;

function requireText(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`${field} must be a non-empty string`);
  }
  return value.trim();
}

function finiteInRange(value, field, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    throw new RangeError(`${field} must be between ${min} and ${max}`);
  }
  return number;
}

function parseLocalParts(localDate, localTime) {
  const dateMatch = DATE_PATTERN.exec(requireText(localDate, 'scheduledLocal.date'));
  const timeMatch = TIME_PATTERN.exec(requireText(localTime, 'scheduledLocal.time'));
  if (!dateMatch || !timeMatch) {
    throw new TypeError('Local date/time must use YYYY-MM-DD and HH:mm or HH:mm:ss');
  }
  const parts = {
    year: Number(dateMatch[1]),
    month: Number(dateMatch[2]),
    day: Number(dateMatch[3]),
    hour: Number(timeMatch[1]),
    minute: Number(timeMatch[2]),
    second: Number(timeMatch[3] ?? 0),
  };
  const naiveMs = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  const roundTrip = new Date(naiveMs);
  const valid = parts.month >= 1 && parts.month <= 12
    && parts.day >= 1 && parts.day <= 31
    && parts.hour >= 0 && parts.hour <= 23
    && parts.minute >= 0 && parts.minute <= 59
    && parts.second >= 0 && parts.second <= 59
    && roundTrip.getUTCFullYear() === parts.year
    && roundTrip.getUTCMonth() === parts.month - 1
    && roundTrip.getUTCDate() === parts.day;
  if (!valid) throw new RangeError('Local date/time is outside the calendar range');
  return { ...parts, naiveMs };
}

function formatterFor(timeZone) {
  const zone = requireText(timeZone, 'scheduledLocal.timeZone');
  try {
    return {
      zone,
      formatter: new Intl.DateTimeFormat('en-CA', {
        timeZone: zone,
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    };
  } catch {
    throw new RangeError(`Unknown IANA time zone: ${zone}`);
  }
}

function zonedParts(formatter, instantMs) {
  const values = {};
  for (const { type, value } of formatter.formatToParts(new Date(instantMs))) {
    if (['year', 'month', 'day', 'hour', 'minute', 'second'].includes(type)) {
      values[type] = Number(value);
    }
  }
  return values;
}

function partsMatch(left, right) {
  return left.year === right.year
    && left.month === right.month
    && left.day === right.day
    && left.hour === right.hour
    && left.minute === right.minute
    && left.second === right.second;
}

/**
 * Resolve a wall-clock time without silently guessing across DST folds/gaps.
 * Zero candidates means nonexistent local time; two means an ambiguous fold.
 */
export function resolveZonedLocalTime({ localDate, localTime, timeZone }) {
  const wanted = parseLocalParts(localDate, localTime);
  const { formatter, zone } = formatterFor(timeZone);
  const offsets = new Set();

  for (let hours = -48; hours <= 48; hours += 6) {
    const sampleMs = wanted.naiveMs + hours * 60 * 60 * 1000;
    const local = zonedParts(formatter, sampleMs);
    const asUtc = Date.UTC(
      local.year,
      local.month - 1,
      local.day,
      local.hour,
      local.minute,
      local.second,
    );
    offsets.add(asUtc - sampleMs);
  }

  const candidates = [...offsets]
    .map((offset) => wanted.naiveMs - offset)
    .filter((instantMs) => partsMatch(zonedParts(formatter, instantMs), wanted))
    .filter((instantMs, index, values) => values.indexOf(instantMs) === index)
    .sort((left, right) => left - right)
    .map((instantMs) => new Date(instantMs).toISOString());

  return Object.freeze({
    localDate,
    localTime: `${String(wanted.hour).padStart(2, '0')}:${String(wanted.minute).padStart(2, '0')}:${String(wanted.second).padStart(2, '0')}`,
    timeZone: zone,
    status: candidates.length === 1 ? 'exact' : candidates.length === 0 ? 'nonexistent' : 'ambiguous',
    candidates: Object.freeze(candidates),
  });
}

function normalizeParticipants(participants) {
  if (!participants || typeof participants !== 'object') {
    throw new TypeError('participants must identify home and away sides');
  }
  return Object.freeze({
    home: requireText(participants.home, 'participants.home'),
    away: requireText(participants.away, 'participants.away'),
  });
}

function normalizeSource(source = { kind: 'manual' }) {
  const kind = requireText(source.kind ?? 'manual', 'source.kind');
  if (!['manual', 'provider', 'import'].includes(kind)) {
    throw new RangeError(`Unsupported event source kind: ${kind}`);
  }
  return Object.freeze({
    kind,
    provider: source.provider == null ? null : requireText(source.provider, 'source.provider'),
    sourceEventId: source.sourceEventId == null ? null : requireText(source.sourceEventId, 'source.sourceEventId'),
    retrievedAt: source.retrievedAt == null ? null : new Date(source.retrievedAt).toISOString(),
  });
}

/** Produce the canonical, chart-safe version 1 event record. */
export function normalizeEvent(input) {
  if (!input || typeof input !== 'object') throw new TypeError('Event input is required');
  if (input.schemaVersion != null && input.schemaVersion !== 1) {
    throw new RangeError(`Unsupported event schema version: ${input.schemaVersion}`);
  }

  const scheduled = input.scheduledLocal ?? {};
  const timeResolution = resolveZonedLocalTime({
    localDate: scheduled.date,
    localTime: scheduled.time,
    timeZone: scheduled.timeZone,
  });
  if (timeResolution.status === 'nonexistent') {
    throw new RangeError('Scheduled local time does not exist in this time zone because of a clock change');
  }

  let utcStart = timeResolution.candidates[0];
  if (timeResolution.status === 'ambiguous') {
    if (input.utcStart == null) {
      throw new RangeError('Scheduled local time is ambiguous; select and supply one matching UTC instant');
    }
    const supplied = new Date(input.utcStart).toISOString();
    if (!timeResolution.candidates.includes(supplied)) {
      throw new RangeError('utcStart does not match either valid instant for the ambiguous local time');
    }
    utcStart = supplied;
  } else if (input.utcStart != null && new Date(input.utcStart).toISOString() !== utcStart) {
    throw new RangeError('utcStart does not match the supplied local time and IANA zone');
  }

  const durationMinutes = input.durationMinutes == null ? null : Number(input.durationMinutes);
  if (durationMinutes != null && (!Number.isFinite(durationMinutes) || durationMinutes < 0)) {
    throw new RangeError('durationMinutes must be a non-negative number');
  }

  const venue = input.venue ?? {};
  return Object.freeze({
    schemaVersion: 1,
    id: requireText(input.id, 'id'),
    title: requireText(input.title, 'title'),
    sport: requireText(input.sport, 'sport'),
    competition: requireText(input.competition, 'competition'),
    participants: normalizeParticipants(input.participants),
    scheduledLocal: Object.freeze({
      date: timeResolution.localDate,
      time: timeResolution.localTime,
      timeZone: timeResolution.timeZone,
    }),
    utcStart,
    durationMinutes,
    venue: Object.freeze({
      name: requireText(venue.name, 'venue.name'),
      latitude: finiteInRange(venue.latitude, 'venue.latitude', -90, 90),
      longitude: finiteInRange(venue.longitude, 'venue.longitude', -180, 180),
      coordinateSource: requireText(venue.coordinateSource ?? 'user-confirmed', 'venue.coordinateSource'),
    }),
    source: normalizeSource(input.source),
  });
}

export function serializeEvent(event) {
  return `${JSON.stringify(normalizeEvent(event), null, 2)}\n`;
}

export function parseEventJson(json) {
  if (typeof json !== 'string') throw new TypeError('Event JSON must be text');
  return normalizeEvent(JSON.parse(json));
}
