'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  cultivars, facets, fmtDate, getEvaluations, withBase, CATEGORIES, SCALE,
  type Cultivar, type Evaluation,
} from '@/lib/data';
import {
  applyToCultivar, applyToEvaluations, diffEdit, fieldsOf, roundAverage,
  EMPTY_EDITS, type CultivarEdit, type CultivarFields, type EditsFile,
} from '@/lib/cultivar-edits';
import { LIGHT_EXPOSURES } from '@/lib/cultivar-validate.mjs';
import { AvgBadge } from '@/components/Ui';
import { ADMIN_DEMO } from '@admin-demo';
import { call, errorText, Field, inputClass } from '@/components/admin/shared';

// Edit any cultivar's details and round scores. Only differences from the spreadsheet are
// saved (see lib/cultivar-edits.ts), so "restore" is always possible.

type Draft = { fields: CultivarFields; evals: Evaluation[] };
type Errors = Record<string, string>;

const COLORS = ['Red', 'Pink', 'Orange', 'Yellow', 'White', 'Blue', 'Purple', 'Multicolor', 'Unknown'];
const SWATCH: Record<string, string> = {
  Red: '#C8102E', Pink: '#E86FA5', Orange: '#F28C28', Yellow: '#F6D33C', White: '#FFFFFF',
  Blue: '#3E64C8', Purple: '#7B3FA0',
  Multicolor: 'conic-gradient(#C8102E, #F6D33C, #3E64C8, #E86FA5, #C8102E)',
  Unknown: 'repeating-linear-gradient(45deg, #D8D4D7 0 3px, #fff 3px 6px)',
};
const PLANTING = [{ value: 'In Ground', label: 'In-ground' }, { value: 'In Basket', label: 'In-basket' }];
const LIGHT = [{ value: '', label: 'Not recorded' }, ...LIGHT_EXPOSURES.map((l: string) => ({ value: l, label: l }))];
const SCORES = [5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1];
const scoreLabel = (v: number) => `${v.toFixed(1)}${SCALE.find((s) => s.v === v) ? ` · ${SCALE.find((s) => s.v === v)!.label}` : ''}`;
const show = (v: unknown) => (v === null || v === undefined || v === '' ? 'blank' : String(v));

// oldest round first, the order they were scored in
const originalOf = (c: Cultivar): Draft => ({ fields: fieldsOf(c), evals: getEvaluations(c.id).reverse() });
const savedOf = (c: Cultivar, edit: CultivarEdit | undefined): Draft => {
  const o = originalOf(c);
  return { fields: fieldsOf(applyToCultivar(c, edit)), evals: applyToEvaluations(o.evals, edit) };
};
const countChanges = (e: CultivarEdit) =>
  Object.keys(e.fields).length + Object.values(e.rounds).reduce((n, r) => n + Object.keys(r).length, 0);

export default function CultivarEditor({ token, onSignOut }: { token: string; onSignOut: (message?: string) => void }) {
  const [edits, setEdits] = useState<EditsFile>(EMPTY_EDITS);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState('');
  const [onlyEdited, setOnlyEdited] = useState(false);
  const [selectedId, setSelectedId] = useState(cultivars[0]?.id ?? '');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    call('/cultivars')
      .then((r) => { if (r.ok && r.data?.cultivars) setEdits(r.data); })
      .catch(() => setStatus({ kind: 'error', text: "Couldn't load saved changes." }))
      .finally(() => setLoaded(true));
  }, []);

  const base = cultivars.find((c) => c.id === selectedId);
  const original = useMemo(() => (base ? originalOf(base) : null), [base]);
  const saved = useMemo(() => (base ? savedOf(base, edits.cultivars[base.id]) : null), [base, edits]);

  // start each cultivar from its saved version
  useEffect(() => { if (loaded) setDraft(saved); }, [saved, loaded]);

  const unsaved = !!(draft && saved) && countChanges(diffEdit(saved, draft)) > 0;

  // the browser asks before leaving the page with unsaved changes
  useEffect(() => {
    if (!unsaved) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    addEventListener('beforeunload', warn);
    return () => removeEventListener('beforeunload', warn);
  }, [unsaved]);

  const choose = (id: string) => {
    if (id === selectedId) return;
    if (unsaved && !confirm(`Discard your unsaved changes to ${draft!.fields.name}?`)) return;
    setSelectedId(id);
    setErrors({});
    setStatus(null);
    // on narrow screens the editor sits below the list, so bring it into view
    if (matchMedia('(max-width: 1023px)').matches) {
      requestAnimationFrame(() => formRef.current?.scrollIntoView({ block: 'start' }));
    }
  };

  const needle = query.trim().toLowerCase();
  const list = cultivars
    .map((c) => applyToCultivar(c, edits.cultivars[c.id]))
    .filter((c) => !onlyEdited || edits.cultivars[c.id])
    .filter((c) => !needle || `${c.name} ${c.genus} ${c.supplier ?? ''}`.toLowerCase().includes(needle));
  const editedCount = Object.keys(edits.cultivars).length;

  const setField = <K extends keyof CultivarFields>(k: K, v: CultivarFields[K]) => {
    setDraft((d) => d && { ...d, fields: { ...d.fields, [k]: v } });
    setStatus(null);
  };
  const setRound = (date: string, patch: Partial<Evaluation>) => {
    setDraft((d) => d && { ...d, evals: d.evals.map((e) => (e.date === date ? { ...e, ...patch } : e)) });
    setStatus(null);
  };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft || !original || !base) return;
    setBusy(true);
    setStatus(null);
    try {
      const edit = diffEdit(original, draft);
      const r = await call(`/cultivars/${base.id}`, { method: 'PUT', token, body: JSON.stringify(edit) });
      if (r.status === 401) { onSignOut(r.data.error || 'Your session has expired. Sign in again.'); return; }
      if (!r.ok) {
        setErrors(r.data.fields || {});
        setStatus({ kind: 'error', text: r.data.error || 'Save failed.' });
        return;
      }
      setErrors({});
      setEdits((all) => {
        const next = { ...all.cultivars };
        if (countChanges(r.data)) next[base.id] = r.data; else delete next[base.id];
        return { ...all, cultivars: next };
      });
      setStatus({
        kind: 'ok',
        text: `Saved${ADMIN_DEMO ? ' in this browser' : ''}. The public page shows this now.`,
      });
    } catch {
      setStatus({ kind: 'error', text: "Couldn't reach the admin service. Nothing was saved." });
    } finally {
      setBusy(false);
    }
  }

  if (!loaded || !draft || !original || !base) return <p className="text-muted">Loading cultivars…</p>;

  const changedFromSheet = countChanges(diffEdit(original, draft));
  const colors = [...COLORS, ...facets.colors.filter((c) => !COLORS.includes(c))];
  if (draft.fields.flowerColor && !colors.includes(draft.fields.flowerColor)) colors.push(draft.fields.flowerColor);
  const thumb = [...base.images].reverse().find((i) => i.mirrored);

  return (
    <div className="grid gap-8 lg:grid-cols-[17rem_minmax(0,1fr)]">
      {/* ---- pick a cultivar ---- */}
      <nav aria-label="Cultivars" className="border border-line bg-white lg:sticky lg:top-4 lg:self-start">
        <div className="border-b border-line p-3">
          <label htmlFor="cultivar-search" className="text-sm font-medium">Find a cultivar</label>
          <input
            id="cultivar-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name, genus, or supplier"
            className={`mt-1 ${inputClass}`}
          />
          <label className="mt-2 flex items-center gap-2 text-xs text-muted">
            <input type="checkbox" checked={onlyEdited} onChange={(e) => setOnlyEdited(e.target.checked)} />
            Only show edited ({editedCount})
          </label>
        </div>
        <ul className="max-h-72 overflow-y-auto lg:max-h-[70vh]">
          {list.map((c) => {
            const selected = c.id === selectedId;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => choose(c.id)}
                  aria-current={selected ? 'true' : undefined}
                  className={`flex w-full items-center gap-3 border-l-4 px-3 py-2 text-left text-sm transition ${
                    selected ? 'border-uf-orange bg-ground' : 'border-transparent hover:bg-ground'
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{c.name}</span>
                    <span className="block truncate text-xs text-muted">{c.genus}</span>
                  </span>
                  {edits.cultivars[c.id] && (
                    <span className="shrink-0 bg-uf-blue px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[.08em] text-white">
                      Edited
                    </span>
                  )}
                </button>
              </li>
            );
          })}
          {list.length === 0 && <li className="p-4 text-sm text-muted">No cultivars match.</li>}
        </ul>
      </nav>

      {/* ---- edit it ---- */}
      <form ref={formRef} onSubmit={save} noValidate aria-label={`Edit ${draft.fields.name}`} className="min-w-0">
        <div className="flex flex-wrap items-center gap-4 border border-line bg-white p-4">
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={withBase(thumb.thumb ?? thumb.local)} alt="" className="h-16 w-16 object-cover" />
          ) : <span className="h-16 w-16 bg-ground" />}
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-2xl font-bold leading-tight">{draft.fields.name || base.name}</h2>
            <p className="text-sm text-muted">
              {draft.fields.genus} · {edits.cultivars[base.id]?.updatedAt
                ? `Last edited ${new Date(edits.cultivars[base.id].updatedAt!).toLocaleString('en-US')}`
                : 'Spreadsheet values, not edited'}
            </p>
          </div>
          <Link
            href={`/trial-gardens/${base.id}/`}
            target="_blank"
            className="text-sm font-semibold text-uf-blue underline underline-offset-4"
          >
            View public page ↗
          </Link>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
          <div className="space-y-6">
            <Panel title="Plant details">
              <Field id="f-name" label="Cultivar name" error={errors.name}>
                <input id="f-name" value={draft.fields.name} maxLength={120} onChange={(e) => setField('name', e.target.value)} className={inputClass} />
              </Field>
              <WasHint value={original.fields.name} current={draft.fields.name} onUse={() => setField('name', original.fields.name)} />

              <Field id="f-genus" label="Genus" error={errors.genus}>
                <input id="f-genus" list="genus-options" value={draft.fields.genus} maxLength={80} onChange={(e) => setField('genus', e.target.value)} className={inputClass} />
              </Field>
              <datalist id="genus-options">{facets.genera.map((g) => <option key={g} value={g} />)}</datalist>
              <WasHint value={original.fields.genus} current={draft.fields.genus} onUse={() => setField('genus', original.fields.genus)} />

              <Field id="f-supplier" label="Supplier" hint="optional" error={errors.supplier}>
                <input id="f-supplier" list="supplier-options" value={draft.fields.supplier ?? ''} maxLength={80} onChange={(e) => setField('supplier', e.target.value || null)} className={inputClass} />
              </Field>
              <datalist id="supplier-options">{facets.suppliers.map((s) => <option key={s} value={s} />)}</datalist>
              <WasHint value={original.fields.supplier} current={draft.fields.supplier} onUse={() => setField('supplier', original.fields.supplier)} />

              <Field id="f-year" label="Trial year" hint="optional" error={errors.year}>
                <input
                  id="f-year" type="number" inputMode="numeric" min={1990} max={2100}
                  value={draft.fields.year ?? ''}
                  onChange={(e) => setField('year', e.target.value === '' ? null : Number(e.target.value))}
                  className={inputClass}
                />
              </Field>
              <WasHint value={original.fields.year} current={draft.fields.year} onUse={() => setField('year', original.fields.year)} />
            </Panel>

            <Panel title="Growing conditions">
              <Choice
                legend="Flower color" name="flowerColor" error={errors.flowerColor}
                value={draft.fields.flowerColor ?? 'Unknown'}
                options={colors.map((c) => ({ value: c, label: c, swatch: SWATCH[c] }))}
                onChange={(v) => setField('flowerColor', v)}
              />
              <WasHint value={original.fields.flowerColor} current={draft.fields.flowerColor} onUse={() => setField('flowerColor', original.fields.flowerColor)} />
              <Choice
                legend="Light exposure" name="lightExposure" error={errors.lightExposure}
                value={draft.fields.lightExposure} options={LIGHT}
                onChange={(v) => setField('lightExposure', v)}
              />
              <WasHint value={original.fields.lightExposure} current={draft.fields.lightExposure} onUse={() => setField('lightExposure', original.fields.lightExposure)} />
              <Choice
                legend="Planting type" name="status" error={errors.status}
                value={draft.fields.status} options={PLANTING}
                onChange={(v) => setField('status', v)}
              />
              <WasHint value={original.fields.status} current={draft.fields.status} onUse={() => setField('status', original.fields.status)} />
            </Panel>
          </div>

          <Panel title="Evaluation rounds">
            <p className="-mt-2 text-sm text-muted">
              Scores run from 1 (unacceptable) to 5 (excellent) in half steps. The round&rsquo;s
              average updates as you go. Adding or replacing photos comes with batch upload.
            </p>
            {draft.evals.map((e, i) => (
              <RoundCard
                key={e.date}
                c={base}
                index={i}
                round={e}
                original={original.evals.find((o) => o.date === e.date)!}
                errors={errors}
                onChange={(patch) => setRound(e.date, patch)}
              />
            ))}
          </Panel>
        </div>

        {/* ---- save bar: always in reach while scrolling a long form ---- */}
        <div className="sticky bottom-0 z-10 mt-6 flex flex-wrap items-center gap-3 border border-line border-t-4 border-t-uf-blue bg-white p-4 shadow-[0_-4px_12px_rgba(0,0,0,.06)]">
          <div className="min-w-0 flex-1 text-sm">
            {status ? (
              <p role={status.kind === 'error' ? 'alert' : 'status'} className={status.kind === 'error' ? errorText : 'font-medium text-uf-blue'}>
                {status.text}{' '}
                {status.kind === 'ok' && (
                  <Link href={`/trial-gardens/${base.id}/`} className="underline underline-offset-4">View it</Link>
                )}
              </p>
            ) : unsaved ? (
              <p className="font-medium">You have unsaved changes.</p>
            ) : (
              <p className="text-muted">
                {changedFromSheet
                  ? `${changedFromSheet} value${changedFromSheet === 1 ? '' : 's'} differ from the spreadsheet.`
                  : 'Matches the spreadsheet.'}
              </p>
            )}
          </div>
          {changedFromSheet > 0 && (
            <button
              type="button"
              onClick={() => { setDraft(original); setErrors({}); setStatus(null); }}
              className="text-sm font-semibold text-uf-blue underline underline-offset-4"
            >
              Restore spreadsheet values
            </button>
          )}
          <button
            type="button"
            disabled={!unsaved || busy}
            onClick={() => { setDraft(saved); setErrors({}); setStatus(null); }}
            className="border border-line px-4 py-2.5 text-sm font-semibold disabled:opacity-40"
          >
            Discard changes
          </button>
          <button type="submit" disabled={!unsaved || busy} className="bg-uf-blue px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40">
            {busy ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 border border-line bg-white p-5">
      <h3 className="font-display text-lg font-bold">{title}</h3>
      {children}
    </section>
  );
}

// Shown under a field once it differs from the spreadsheet, with a one-click way back.
function WasHint({ value, current, onUse }: { value: unknown; current: unknown; onUse: () => void }) {
  if ((value ?? '') === (current ?? '')) return null;
  return (
    <p className="-mt-2 border-l-4 border-uf-orange pl-2 text-xs text-muted">
      Spreadsheet: <span className="font-medium text-ink">{show(value)}</span>{' '}
      <button type="button" onClick={onUse} className="font-semibold text-uf-blue underline underline-offset-2">
        Use this
      </button>
    </p>
  );
}

// A row of pill-shaped radio buttons: every option visible, one click to pick.
function Choice({ legend, name, value, options, onChange, error }: {
  legend: string; name: string; value: string; error?: string;
  options: { value: string; label: string; swatch?: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((o) => {
          const checked = o.value === value;
          return (
            <label
              key={o.value}
              className={`flex cursor-pointer items-center gap-2 border px-3 py-1.5 text-sm transition has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-uf-blue ${
                checked ? 'border-uf-blue bg-uf-blue text-white' : 'border-line bg-white hover:border-uf-orange'
              }`}
            >
              <input type="radio" name={name} value={o.value} checked={checked} onChange={() => onChange(o.value)} className="sr-only" />
              {o.swatch && <span aria-hidden className="h-3.5 w-3.5 rounded-full border border-black/20" style={{ background: o.swatch }} />}
              {o.label}
            </label>
          );
        })}
      </div>
      {error && <p className={`mt-1 ${errorText}`}>{error}</p>}
    </fieldset>
  );
}

function RoundCard({ c, index, round, original, errors, onChange }: {
  c: Cultivar; index: number; round: Evaluation; original: Evaluation; errors: Errors;
  onChange: (patch: Partial<Evaluation>) => void;
}) {
  const img = c.images.find((i) => i.date === round.date && i.mirrored);
  const scoresChanged = CATEGORIES.some((cat) => round[cat.key] !== original[cat.key]);
  const avg = scoresChanged ? roundAverage(round) : round.avg;
  const id = (k: string) => `r-${round.date}-${k}`;

  return (
    <article aria-label={`Round ${index + 1}, ${fmtDate(round.date)}`} className="border border-line">
      <header className="flex items-center gap-3 border-b border-line bg-ground px-3 py-2">
        {img ? (
          <a href={withBase(img.local)} target="_blank" rel="noreferrer" title="Open the full photo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={withBase(img.thumb ?? img.local)} alt={`${c.name}, ${fmtDate(round.date)}`} className="h-14 w-14 object-cover" />
          </a>
        ) : (
          <span className="grid h-14 w-14 place-items-center bg-white text-center text-[10px] leading-tight text-muted">No photo</span>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[11px] uppercase tracking-[.12em] text-muted">Round {index + 1}</p>
          <p className="font-semibold">{fmtDate(round.date)}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted">Average</span>
          <AvgBadge value={avg} />
        </div>
      </header>

      <div className="grid gap-3 p-3 sm:grid-cols-2">
        {CATEGORIES.map((cat) => {
          const changed = round[cat.key] !== original[cat.key];
          return (
            <div key={cat.key} className={`flex flex-col gap-1 ${changed ? 'border-l-4 border-uf-orange pl-2' : ''}`}>
              <label htmlFor={id(cat.key)} className="text-sm font-medium" title={cat.blurb}>{cat.label}</label>
              <select
                id={id(cat.key)}
                value={round[cat.key] ?? ''}
                onChange={(e) => onChange({ [cat.key]: e.target.value === '' ? null : Number(e.target.value) })}
                className={inputClass}
              >
                <option value="">Not scored</option>
                {SCORES.map((v) => <option key={v} value={v}>{scoreLabel(v)}</option>)}
              </select>
              {changed && (
                <p className="text-xs text-muted">
                  Spreadsheet: {original[cat.key]?.toFixed(1) ?? 'not scored'}{' '}
                  <button type="button" onClick={() => onChange({ [cat.key]: original[cat.key] })} className="font-semibold text-uf-blue underline underline-offset-2">
                    Use this
                  </button>
                </p>
              )}
              {errors[`${round.date}.${cat.key}`] && <p className={errorText}>{errors[`${round.date}.${cat.key}`]}</p>}
            </div>
          );
        })}
        <div className="sm:col-span-2">
          <Field id={id('notes')} label="Notes" hint="optional, shown with this round's photo" error={errors[`${round.date}.notes`]}>
            <textarea
              id={id('notes')} rows={2} maxLength={500}
              value={round.notes ?? ''}
              onChange={(e) => onChange({ notes: e.target.value || null })}
              className={inputClass}
            />
          </Field>
        </div>
      </div>
    </article>
  );
}
