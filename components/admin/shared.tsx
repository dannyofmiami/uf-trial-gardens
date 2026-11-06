'use client';

import { withBase } from '@/lib/data';
import { ADMIN_DEMO, demoCall } from '@admin-demo';

// The admin API checks the password and saves changes; the admin page never sees or stores
// the password itself, only a signed session token (kept for this browser tab).
const API = process.env.NEXT_PUBLIC_ADMIN_API_URL || withBase('/api/admin');
const TOKEN_KEY = 'trial-gardens-admin-token';

export async function call(path: string, init: RequestInit & { token?: string } = {}) {
  if (ADMIN_DEMO) return demoCall(path, init);
  const { token, ...rest } = init;
  const res = await fetch(`${API}${path}`, {
    ...rest,
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

export const storage = {
  get: () => { try { return sessionStorage.getItem(TOKEN_KEY); } catch { return null; } },
  set: (t: string) => { try { sessionStorage.setItem(TOKEN_KEY, t); } catch {} },
  clear: () => { try { sessionStorage.removeItem(TOKEN_KEY); } catch {} },
};

export const inputClass = 'w-full border border-line bg-white px-3 py-2 text-sm';
export const errorText = 'text-sm font-medium text-[#B3261E]';

export function Field({ id, label, hint, error, children }: {
  id: string; label: string; hint?: string; error?: string; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label} {hint && <span className="font-normal text-muted">({hint})</span>}
      </label>
      {children}
      {error && <p className={errorText}>{error}</p>}
    </div>
  );
}
