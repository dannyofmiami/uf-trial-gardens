// Admin API core: password login, signed sessions, and banner reads/writes.
// Plain Node, no dependencies, and no HTTP framework -- the same handler runs behind the
// local dev server (scripts/admin-server.mjs), the test server (tests/serve.mjs) and an
// AWS Lambda (server/lambda.mjs). Storage is passed in, so files locally and S3 in prod.
//
// Routes (relative to the API base, e.g. /api/admin):
//   POST /login    {password}      -> {token, expiresAt}
//   GET  /banner                   -> banner JSON
//   PUT  /banner   (Bearer token)  -> saved banner JSON
//   GET  /session  (Bearer token)  -> {ok: true, expiresAt}

import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { validateBanner } from '../lib/banner-validate.mjs';

export { validateBanner };

const SESSION_HOURS = 8;
const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

const sha256 = (s) => createHash('sha256').update(String(s)).digest();
const b64url = (b) => Buffer.from(b).toString('base64url');

export function createAdminApi({ password, sessionSecret = '', store, now = () => Date.now() }) {
  if (!password || password.length < 12) {
    throw new Error('ADMIN_PASSWORD must be set and at least 12 characters');
  }
  const secret = sessionSecret || randomBytes(32).toString('hex');
  const passwordDigest = sha256(password);
  const failures = new Map(); // ip -> {count, until}

  const sign = (payload) => {
    const body = b64url(JSON.stringify(payload));
    return `${body}.${b64url(createHmac('sha256', secret).update(body).digest())}`;
  };
  const verify = (token) => {
    const [body, mac] = String(token || '').split('.');
    if (!body || !mac) return null;
    const expected = createHmac('sha256', secret).update(body).digest();
    const given = Buffer.from(mac, 'base64url');
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
    try {
      const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
      return payload.exp > now() ? payload : null;
    } catch {
      return null;
    }
  };
  const bearer = (headers) => /^Bearer (.+)$/i.exec(headers.authorization || headers.Authorization || '')?.[1];

  const json = (status, data) => ({
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(data),
  });

  async function handle({ method, path, headers = {}, body = '', ip = 'unknown' }) {
    const route = `${method.toUpperCase()} ${path.replace(/\/+$/, '') || '/'}`;
    try {
      if (route === 'POST /login') {
        const f = failures.get(ip);
        if (f && f.count >= MAX_FAILED_LOGINS && f.until > now()) {
          return json(429, { error: 'Too many attempts. Try again in a few minutes.' });
        }
        const { password: given } = parseJson(body);
        // compare fixed-length digests so the check takes the same time for any input
        if (typeof given !== 'string' || !timingSafeEqual(sha256(given), passwordDigest)) {
          const prev = f && f.until > now() ? f.count : 0;
          failures.set(ip, { count: prev + 1, until: now() + LOCKOUT_MS });
          return json(401, { error: 'Incorrect password.' });
        }
        failures.delete(ip);
        const expiresAt = now() + SESSION_HOURS * 3600 * 1000;
        return json(200, { token: sign({ exp: expiresAt }), expiresAt });
      }

      if (route === 'GET /banner') return json(200, await store.getBanner());

      const session = verify(bearer(headers));
      if (route === 'GET /session') {
        return session ? json(200, { ok: true, expiresAt: session.exp }) : json(401, { error: 'Not signed in.' });
      }
      if (route === 'PUT /banner') {
        if (!session) return json(401, { error: 'Your session has expired. Sign in again.' });
        const result = validateBanner(parseJson(body));
        if (result.errors) return json(400, { error: 'Please fix the highlighted fields.', fields: result.errors });
        const saved = { ...result.banner, updatedAt: new Date(now()).toISOString() };
        await store.putBanner(saved);
        return json(200, saved);
      }
      return json(404, { error: 'Not found.' });
    } catch (err) {
      if (err instanceof SyntaxError) return json(400, { error: 'Request body must be JSON.' });
      console.error('[admin-api]', err);
      return json(500, { error: 'Something went wrong saving that. Try again.' });
    }
  }

  return { handle };
}

function parseJson(body) {
  const v = JSON.parse(body || '{}');
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new SyntaxError('expected an object');
  return v;
}
