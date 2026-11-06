'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { EMPTY_BANNER, isBannerActive, type Banner } from '@/lib/banner';
import BannerView from '@/components/BannerView';
import { ADMIN_DEMO } from '@admin-demo';
import { call, storage, Field } from '@/components/admin/shared';
import CultivarEditor from '@/components/admin/CultivarEditor';

type FieldErrors = Partial<Record<keyof Banner, string>>;
type Tab = 'cultivars' | 'banner';

export default function AdminPanel() {
  const [token, setToken] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const saved = storage.get();
    if (!saved) { setChecking(false); return; }
    call('/session', { token: saved })
      .then((r) => { if (r.ok) setToken(saved); else storage.clear(); })
      .catch(() => setNotice("Couldn't reach the admin service."))
      .finally(() => setChecking(false));
  }, []);

  const signOut = (message = '') => { storage.clear(); setToken(null); setNotice(message); };

  if (checking) return <p className="text-muted">Checking your session…</p>;
  return (
    <>
      {token
        ? <SignedIn token={token} onSignOut={signOut} />
        : <LoginForm notice={notice} onSignedIn={(t) => { storage.set(t); setNotice(''); setToken(t); }} />}
    </>
  );
}

function SignedIn({ token, onSignOut }: { token: string; onSignOut: (message?: string) => void }) {
  const [tab, setTab] = useState<Tab>('cultivars');
  const tabs: { id: Tab; label: string }[] = [
    { id: 'cultivars', label: 'Cultivars' },
    { id: 'banner', label: 'Home page banner' },
  ];
  return (
    <>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-line">
        <div role="tablist" aria-label="What to edit" className="flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`panel-${t.id}`}
              onClick={() => setTab(t.id)}
              className={`-mb-px border-b-4 px-4 py-3 text-sm font-semibold transition ${
                tab === t.id ? 'border-uf-orange text-ink' : 'border-transparent text-muted hover:text-uf-blue'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => onSignOut('Signed out.')} className="mb-3 text-sm font-semibold text-uf-blue underline underline-offset-4">
          Sign out
        </button>
      </div>
      {/* both stay mounted, so switching tabs never loses unsaved work */}
      <div role="tabpanel" id="panel-cultivars" aria-labelledby="tab-cultivars" hidden={tab !== 'cultivars'}>
        <CultivarEditor token={token} onSignOut={onSignOut} />
      </div>
      <div role="tabpanel" id="panel-banner" aria-labelledby="tab-banner" hidden={tab !== 'banner'}>
        <BannerEditor token={token} onSignOut={onSignOut} />
      </div>
    </>
  );
}

function LoginForm({ notice, onSignedIn }: { notice: string; onSignedIn: (token: string) => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await call('/login', { method: 'POST', body: JSON.stringify({ password }) });
      if (r.ok) onSignedIn(r.data.token);
      else setError(r.data.error || 'Sign-in failed.');
    } catch {
      setError("Couldn't reach the admin service. Check that it's running.");
    } finally {
      setBusy(false);
      setPassword('');
    }
  }

  return (
    <form onSubmit={submit} className="max-w-sm border border-line bg-white p-6">
      <h2 className="font-display text-xl font-bold">Sign in</h2>
      {notice && <p role="status" className="mt-3 text-sm text-ifas-gray">{notice}</p>}
      <label htmlFor="admin-password" className="mt-5 block text-sm font-medium">Password</label>
      <input
        id="admin-password"
        type="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="mt-1 w-full border border-line px-3 py-2 text-sm"
      />
      {error && <p role="alert" className="mt-3 text-sm font-medium text-[#B3261E]">{error}</p>}
      <button type="submit" disabled={busy} className="mt-5 bg-uf-blue px-5 py-3 font-semibold text-white disabled:opacity-60">
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}

function BannerEditor({ token, onSignOut }: { token: string; onSignOut: (message?: string) => void }) {
  const [banner, setBanner] = useState<Banner>(EMPTY_BANNER);
  const [loaded, setLoaded] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    call('/banner')
      .then((r) => { if (r.ok) setBanner({ ...EMPTY_BANNER, ...r.data }); })
      .catch(() => setStatus({ kind: 'error', text: "Couldn't load the current banner." }))
      .finally(() => setLoaded(true));
  }, []);

  const set = <K extends keyof Banner>(k: K, v: Banner[K]) => {
    setBanner((b) => ({ ...b, [k]: v }));
    setStatus(null);
  };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      const { updatedAt: _ignored, ...edit } = banner;
      const r = await call('/banner', { method: 'PUT', token, body: JSON.stringify(edit) });
      if (r.status === 401) { onSignOut(r.data.error || 'Your session has expired. Sign in again.'); return; }
      if (!r.ok) {
        setErrors(r.data.fields || {});
        setStatus({ kind: 'error', text: r.data.error || 'Save failed.' });
        return;
      }
      setErrors({});
      setBanner({ ...EMPTY_BANNER, ...r.data });
      setStatus({ kind: 'ok', text: ADMIN_DEMO ? 'Saved in this browser. The home page shows this now.' : 'Saved. The home page shows this now.' });
    } catch {
      setStatus({ kind: 'error', text: "Couldn't reach the admin service. Nothing was saved." });
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) return <p className="text-muted">Loading the current banner…</p>;
  const live: boolean = isBannerActive({ ...banner });

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,26rem)_1fr]">
      <form onSubmit={save} noValidate className="space-y-5 border border-line bg-white p-6">
        <h2 className="font-display text-xl font-bold">Home page banner</h2>

        <label className="flex items-center gap-3 text-sm font-medium">
          <input type="checkbox" checked={banner.enabled} onChange={(e) => set('enabled', e.target.checked)} className="h-5 w-5" />
          Show the banner on the home page
        </label>

        <Field id="title" label="Title" error={errors.title}>
          <input id="title" value={banner.title} maxLength={120} onChange={(e) => set('title', e.target.value)} className="w-full border border-line px-3 py-2 text-sm" />
        </Field>
        <Field id="message" label="Message" hint="Optional. Line breaks are kept." error={errors.message}>
          <textarea id="message" rows={4} value={banner.message} maxLength={500} onChange={(e) => set('message', e.target.value)} className="w-full border border-line px-3 py-2 text-sm" />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="linkLabel" label="Button text" hint="Optional" error={errors.linkLabel}>
            <input id="linkLabel" value={banner.linkLabel} maxLength={40} onChange={(e) => set('linkLabel', e.target.value)} className="w-full border border-line px-3 py-2 text-sm" />
          </Field>
          <Field id="linkUrl" label="Button link" hint="/visit/ or https://…" error={errors.linkUrl}>
            <input id="linkUrl" value={banner.linkUrl} onChange={(e) => set('linkUrl', e.target.value)} className="w-full border border-line px-3 py-2 text-sm" />
          </Field>
          <Field id="showFrom" label="Show from" hint="Optional" error={errors.showFrom}>
            <input id="showFrom" type="date" value={banner.showFrom} onChange={(e) => set('showFrom', e.target.value)} className="w-full border border-line px-3 py-2 text-sm" />
          </Field>
          <Field id="showUntil" label="Show until" hint="Last day shown" error={errors.showUntil}>
            <input id="showUntil" type="date" value={banner.showUntil} onChange={(e) => set('showUntil', e.target.value)} className="w-full border border-line px-3 py-2 text-sm" />
          </Field>
        </div>

        {status && (
          <p role={status.kind === 'error' ? 'alert' : 'status'} className={`text-sm font-medium ${status.kind === 'error' ? 'text-[#B3261E]' : 'text-uf-blue'}`}>
            {status.text}{' '}
            {status.kind === 'ok' && <Link href="/" className="underline underline-offset-4">View the home page</Link>}
          </p>
        )}
        <button type="submit" disabled={busy} className="bg-uf-blue px-5 py-3 font-semibold text-white disabled:opacity-60">
          {busy ? 'Saving…' : 'Save banner'}
        </button>
        {banner.updatedAt && (
          <p className="text-xs text-muted">Last saved {new Date(banner.updatedAt).toLocaleString('en-US')}</p>
        )}
      </form>

      <div>
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[.16em] text-muted">Preview</p>
        <p className="mt-1 text-sm text-muted">
          {live
            ? 'Visible on the home page today.'
            : banner.enabled ? 'Hidden today: outside its show-from / show-until dates, or missing a title.' : 'Hidden: the banner is switched off.'}
        </p>
        <div className="mt-3 border border-line">
          {banner.title.trim() ? <BannerView banner={banner} headingLevel="p" /> : (
            <p className="p-6 text-sm text-muted">Add a title to preview the banner.</p>
          )}
        </div>
      </div>
    </div>
  );
}
