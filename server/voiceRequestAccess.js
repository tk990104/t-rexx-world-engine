const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const LOCAL_PEERS = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

/** Local-browser CSRF/rebinding boundary, NOT authentication for public hosting. */
export function isLocalVoiceRequest(req) {
  const headers = req.headers || {};
  if (!LOCAL_PEERS.has(req.socket?.remoteAddress)) return false;
  const host = headers.host;
  if (typeof host !== 'string' || !/^(localhost|127\.0\.0\.1|\[::1\])(?::[0-9]{1,5})?$/i.test(host)) return false;
  let target;
  try { target = new URL(`${req.socket.encrypted ? 'https' : 'http'}://${host}`); }
  catch { return false; }
  if (!LOCAL_HOSTS.has(target.hostname)) return false;
  const port = Number(target.port || (target.protocol === 'https:' ? 443 : 80));
  if (port !== req.socket.localPort) return false;

  // Do not trust Forwarded/X-Forwarded-* or Referer to grant access.
  // A conflicting Origin must fail even if Fetch Metadata says same-origin.
  const origin = headers.origin;
  if (origin !== undefined && origin !== target.origin) return false;
  const site = headers['sec-fetch-site'];
  if (site !== undefined && site !== 'same-origin') return false;
  const mode = headers['sec-fetch-mode'];
  if (mode !== undefined && mode !== 'cors' && mode !== 'same-origin') return false;
  const dest = headers['sec-fetch-dest'];
  if (dest !== undefined && dest !== 'empty') return false;
  // Same-origin GET fetch can omit Origin; metadata supplies evidence then.
  return origin === target.origin || site === 'same-origin';
}

export function withLocalVoiceAccess(handler) {
  return (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (isLocalVoiceRequest(req)) return handler(req, res);
    res.statusCode = 403;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Connection', 'close');
    res.end(JSON.stringify({ error: 'Voice routes require a same-origin local browser request' }));
  };
}
