import { normalizeSportsSchedule, normalizeSportsVenue, validScheduleDate } from '../src/modules/astroeye/sportsSchedule.js';

/** Bounded same-origin proxy shared by Vite development and preview servers. */
export function createSportsScheduleHandler({ fetchImpl = globalThis.fetch, now = Date.now, apiKey = () => process.env.THESPORTSDB_API_KEY || '123' } = {}) {
  const cache = new Map();
  const inFlight = new Map();
  let calls = [];
  let blockedUntil = 0;
  const ttl = 15 * 60 * 1000;
  return async (req, res, next) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname !== '/api/astroeye/sports') return next();
    const send = (status, data) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(data)); };
    if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return send(405, { error: 'Use GET for sports schedules.' }); }
    const date = url.searchParams.get('date');
    const venue = url.searchParams.get('venue');
    if ([...url.searchParams.keys()].some((key) => !['date', 'venue'].includes(key) || url.searchParams.getAll(key).length !== 1)
      || (date !== null && !validScheduleDate(date)) || (venue !== null && !/^\d{1,12}$/.test(venue)) || (date !== null && venue !== null)) {
      return send(400, { error: 'Choose a valid schedule date or venue.' });
    }
    const key = venue ? `venue:${venue}` : `schedule:${date || 'next'}`;
    const cached = cache.get(key);
    if (cached && now() - cached.time < ttl) return send(200, { ...cached.data, cached: true });
    try {
      if (!inFlight.has(key)) {
        calls = calls.filter((time) => now() - time < 60000);
        if (now() < blockedUntil || calls.length >= 20) { res.setHeader('Retry-After', '60'); return send(429, { error: 'Schedule requests are temporarily limited. Try again in a minute.' }); }
        calls.push(now());
        const job = (async () => {
          const configuredKey = String(apiKey()).trim();
          if (!/^[a-zA-Z0-9_-]{1,100}$/.test(configuredKey)) throw new Error('Invalid server key');
          const endpoint = venue ? `lookupvenue.php?id=${venue}` : date ? `eventsday.php?d=${date}&l=4391` : 'eventsnextleague.php?id=4391';
          const upstream = await fetchImpl(`https://www.thesportsdb.com/api/v1/json/${configuredKey}/${endpoint}`, { signal: AbortSignal.timeout(12000), redirect: 'error' });
          if (!upstream.ok) { if (upstream.status === 429) blockedUntil = now() + 60000; throw new Error('Provider unavailable'); }
          const payload = await upstream.json();
          const retrievedAt = new Date(now()).toISOString();
          const data = venue ? { venue: normalizeSportsVenue(payload, venue), retrievedAt, source: 'thesportsdb' }
            : { ...normalizeSportsSchedule(payload, retrievedAt), access: configuredKey === '123' ? 'free' : 'configured' };
          if (cache.size >= 128) cache.delete(cache.keys().next().value);
          cache.set(key, { data, time: now() });
          return data;
        })();
        inFlight.set(key, job);
        job.finally(() => inFlight.delete(key)).catch(() => {});
      }
      return send(200, { ...await inFlight.get(key), cached: false });
    } catch {
      // Never forward upstream URLs/errors: V1 URLs contain the private key.
      return send(503, { error: 'TheSportsDB is unavailable. Please retry later or enter the event manually.' });
    }
  };
}

export function sportsScheduleProxy() {
  const handler = createSportsScheduleHandler();
  const install = (server) => { server.middlewares.use(handler); };
  return { name: 'trexx-sports-schedule', configureServer: install, configurePreviewServer: install };
}
