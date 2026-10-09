// TEMPORARY demo of /admin for sharing before hosting is set up. Imported as '@admin-demo',
// which only build:demo points here (next.config.mjs); other builds get admin-demo.off.ts.
//
// It stands in for the admin API inside the browser: the password is hardcoded below
// (so anyone who reads the site's code can find it), and a saved banner is kept in this
// browser's localStorage, so only the person who saved it sees the change. Nothing here
// is secure or shared. Remove it once the real admin API is hosted (server/admin-core.mjs).

import { BANNER_PATH, type Banner } from '@/lib/banner';
import { validateBanner } from '@/lib/banner-validate.mjs';
import { withBase } from '@/lib/data';

export const ADMIN_DEMO = true;
export const DEMO_PASSWORD = 'trial-gardens-demo';

const BANNER_KEY = 'trial-gardens-demo-banner';
const DEMO_TOKEN = 'demo-session';

export function demoBanner(): Banner | null {
  try {
    const saved = localStorage.getItem(BANNER_KEY);
    return saved ? (JSON.parse(saved) as Banner) : null;
  } catch {
    return null;
  }
}

export function resetDemoBanner() {
  try { localStorage.removeItem(BANNER_KEY); } catch {}
}

type Reply = { ok: boolean; status: number; data: any };
const reply = (status: number, data: unknown): Reply => ({ ok: status < 400, status, data });

// Same routes and responses as the admin API, so the admin page works unchanged.
export async function demoCall(path: string, init: RequestInit & { token?: string } = {}): Promise<Reply> {
  const method = init.method ?? 'GET';
  const body = typeof init.body === 'string' ? JSON.parse(init.body) : {};

  if (method === 'POST' && path === '/login') {
    return body.password === DEMO_PASSWORD
      ? reply(200, { token: DEMO_TOKEN })
      : reply(401, { error: 'Incorrect password.' });
  }
  if (method === 'GET' && path === '/session') {
    return init.token === DEMO_TOKEN ? reply(200, { ok: true }) : reply(401, {});
  }
  if (method === 'GET' && path === '/banner') {
    const saved = demoBanner();
    if (saved) return reply(200, saved);
    const r = await fetch(withBase(BANNER_PATH), { cache: 'no-store' });
    return reply(200, r.ok ? await r.json() : {});
  }
  if (method === 'PUT' && path === '/banner') {
    if (init.token !== DEMO_TOKEN) return reply(401, { error: 'Your session has expired. Sign in again.' });
    const result = validateBanner(body);
    if (result.errors) return reply(400, { error: 'Please fix the highlighted fields.', fields: result.errors });
    const saved = { ...result.banner, updatedAt: new Date().toISOString() };
    try { localStorage.setItem(BANNER_KEY, JSON.stringify(saved)); } catch {
      return reply(500, { error: "This browser blocked saving. Nothing was saved." });
    }
    return reply(200, saved);
  }
  return reply(404, { error: 'Not found.' });
}
