'use client';

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  cultivars, facets, fmtDate, getEvaluations, trialHref, withBase, CATEGORIES, SCALE,
  type Cultivar, type Evaluation,
} from '@/lib/data';
import {
  addedCultivar, applyToCultivar, applyToEvaluations, blankRound, diffEdit, fieldsOf, fullEdit, roundAverage,
  EMPTY_EDITS, type CultivarEdit, type CultivarFields, type EditsFile,
} from '@/lib/cultivar-edits';
import { LIGHT_EXPOSURES, newTrialId, trialKey } from '@/lib/cultivar-validate.mjs';
import { AvgBadge } from '@/components/Ui';
import { ADMIN_DEMO } from '@admin-demo';
import { call, errorText, Field, inputClass } from '@/components/admin/shared';

// Edit any trial's details and rounds. For spreadsheet trials only the differences are saved
// (see lib/cultivar-edits.ts), so "restore" is always possible. Trials added here (a cultivar
// trialed again in a new year, light or planting) are saved whole and can be deleted.

type Draft = { fields: CultivarFields; evals: Evaluation[] };
// set inside an added trial's form, which has no spreadsheet values to compare with
const AddedContext = createContext(false);
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
  return { fields: fieldsOf(applyToCultivar(c, edit)), evals: applyToEvaluations(o.evals, edit, 'oldest') };
};
const addedDraft = (id: string, edit: CultivarEdit): Draft =>
  ({ fields: fieldsOf(addedCultivar(id, edit)), evals: applyToEvaluations([], edit, 'oldest') });
const countChanges = (e: CultivarEdit) =>
  Object.keys(e.fields).length + Object.values(e.rounds).reduce((n, r) => n + Object.keys(r).length, 0)
  + (e.removedRounds?.length ?? 0);
const today = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD, local time

export default function CultivarEditor({ token, onSignOut }: { token: string; onSignOut: (message?: string) => void }) {
  const [edits, setEdits] = useState<EditsFile>(EMPTY_EDITS);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState('');
  const [onlyEdited, setOnlyEdited] = useState(false);
  const [selectedId, setSelectedId] = useState(cultivars[0]?.id ?? '');
  // a new trial that hasn't been saved yet
  const [pending, setPending] = useState<{ id: string; draft: Draft } | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [newRoundDate, setNewRoundDate] = useState(today);
  const [errors, setErrors] = useState<Errors>({});
  // link: offer "View it" (after a save)
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string; link?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    call('/cultivars')
      .then((r) => { if (r.ok && r.data?.cultivars) setEdits(r.data); })
      .catch(() => setStatus({ kind: 'error', text: "Couldn't load saved changes." }))
      .finally(() => setLoaded(true));
  }, []);

  const selectedEdit = edits.cultivars[selectedId];
  const isPending = pending?.id === selectedId;
  const isAdded = isPending || !!selectedEdit?.added;
  const base = useMemo(() => {
    if (isPending) return addedCultivar(pending!.id, fullEdit(pending!.draft));
    if (selectedEdit?.added) return addedCultivar(selectedId, selectedEdit);
    return cultivars.find((c) => c.id === selectedId);
  }, [selectedId, selectedEdit, isPending, pending]);
  const saved = useMemo(() => {
    if (!base) return null;
    if (isPending) return pending!.draft;
    if (selectedEdit?.added) return addedDraft(selectedId, selectedEdit);
    return savedOf(base, selectedEdit);
  }, [base, selectedId, selectedEdit, isPending, pending]);
  // spreadsheet trials compare against the sheet; added ones have nothing behind them
  const original = useMemo(() => (base && !isAdded ? originalOf(base) : saved), [base, isAdded, saved]);

  // start each trial from its saved version
  useEffect(() => { if (loaded) setDraft(saved); }, [saved, loaded]);

  const unsaved = isPending || (!!(draft && saved) && countChanges(diffEdit(saved, draft)) > 0);

  // the browser asks before leaving the page with unsaved changes
  useEffect(() => {
    if (!unsaved) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    addEventListener('beforeunload', warn);
    return () => removeEventListener('beforeunload', warn);
  }, [unsaved]);

  const choose = (id: string) => {
    if (id === selectedId) return;
    if (unsaved && !confirm(`Discard your unsaved changes to ${draft!.fields.name || 'this new trial'}?`)) return;
    if (pending && id !== pending.id) setPending(null);
    setSelectedId(id);
    setErrors({});
    setStatus(null);
    // on narrow screens the editor sits below the list, so bring it into view
    if (matchMedia('(max-width: 1023px)').matches) {
      requestAnimationFrame(() => formRef.current?.scrollIntoView({ block: 'start' }));
    }
  };

  // A new trial: the same cultivar again (a new year, light or planting), or a blank one.
  const startNew = (from?: CultivarFields) => {
    if (unsaved && !confirm(`Discard your unsaved changes to ${draft!.fields.name || 'this new trial'}?`)) return;
    const id = newTrialId();
    const fields: CultivarFields = from
      ? { ...from, year: (from.year ?? new Date().getFullYear()) + 1, lightExposure: '' }
      : { name: '', genus: '', supplier: null, flowerColor: 'Unknown', year: new Date().getFullYear() + 1, status: 'In Ground', lightExposure: '' };
    setPending({ id, draft: { fields, evals: [] } });
    setSelectedId(id);
    setErrors({});
    setStatus(null);
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ block: 'start' }));
  };

  const needle = query.trim().toLowerCase();
  const all = [
    ...cultivars.map((c) => applyToCultivar(c, edits.cultivars[c.id])),
    ...Object.entries(edits.cultivars).filter(([, e]) => e.added).map(([id, e]) => addedCultivar(id, e))
      .sort((a, b) => a.name.localeCompare(b.name)),
  ];
  const list = [
    ...(pending ? [{ ...addedCultivar(pending.id, fullEdit(pending.draft)), name: pending.draft.fields.name || 'New trial' }] : []),
    ...all
      .filter((c) => !onlyEdited || edits.cultivars[c.id])
      .filter((c) => !needle || `${c.name} ${c.genus} ${c.supplier ?? ''} ${c.year ?? ''}`.toLowerCase().includes(needle)),
  ];
  const editedCount = Object.keys(edits.cultivars).length;

  const setField = <K extends keyof CultivarFields>(k: K, v: CultivarFields[K]) => {
    setDraft((d) => d && { ...d, fields: { ...d.fields, [k]: v } });
    setStatus(null);
  };
  const setRound = (date: string, patch: Partial<Evaluation>) => {
    setDraft((d) => d && { ...d, evals: d.evals.map((e) => (e.date === date ? { ...e, ...patch } : e)) });
    setStatus(null);
  };
  const addRound = (date: string) => {
    if (!draft) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { setErrors({ ...errors, newRound: 'Choose the date of the round.' }); return; }
    if (draft.evals.some((e) => e.date === date)) { setErrors({ ...errors, newRound: `There's already a round on ${fmtDate(date)}.` }); return; }
    // a spreadsheet round that was removed comes back with its sheet values
    const back = original?.evals.find((e) => e.date === date);
    const round = back ?? blankRound(selectedId, date);
    setDraft({ ...draft, evals: [...draft.evals, round].sort((a, b) => a.date.localeCompare(b.date)) });
    setErrors(({ newRound: _, ...rest }) => rest);
    setStatus(null);
  };
  const removeRound = (date: string) => {
    setDraft((d) => d && { ...d, evals: d.evals.filter((e) => e.date !== date) });
    setStatus(null);
  };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft || !original || !base || !saved) return;
    // two trials can't be the same cultivar in the same year, light and planting
    const key = trialKey(draft.fields);
    if (all.some((c) => c.id !== base.id && trialKey(fieldsOf(c)) === key)) {
      setErrors({ year: 'Change the year, light exposure or planting type to tell the trials apart.' });
      setStatus({
        kind: 'error',
        text: 'Another trial already has this cultivar, year, light exposure and planting type.',
      });
      return;
    }
    const removing = saved.evals.filter((e) => !draft.evals.some((d) => d.date === e.date));
    if (removing.length && !confirm(
      `Remove ${removing.length === 1 ? `the ${fmtDate(removing[0].date)} round` : `${removing.length} rounds`} and ${removing.length === 1 ? 'its' : 'their'} scores?`,
    )) return;
    setBusy(true);
    setStatus(null);
    try {
      const edit = isAdded ? fullEdit(draft) : diffEdit(original, draft);
      const r = await call(`/cultivars/${base.id}`, { method: 'PUT', token, body: JSON.stringify(edit) });
      if (r.status === 401) { onSignOut(r.data.error || 'Your session has expired. Sign in again.'); return; }
      if (!r.ok) {
        setErrors(r.data.fields || {});
        setStatus({ kind: 'error', text: r.data.error || 'Save failed.' });
        return;
      }
      setErrors({});
      setEdits((prev) => {
        const next = { ...prev.cultivars };
        if (countChanges(r.data)) next[base.id] = r.data; else delete next[base.id];
        return { ...prev, cultivars: next };
      });
      if (isPending) setPending(null);
      setStatus({
        kind: 'ok',
        text: `Saved${ADMIN_DEMO ? ' in this browser' : ''}. The public page shows this now.`,
        link: true,
      });
    } catch {
      setStatus({ kind: 'error', text: "Couldn't reach the admin service. Nothing was saved." });
    } finally {
      setBusy(false);
    }
  }

  async function deleteTrial() {
    if (!base) return;
    if (isPending) {
      setPending(null);
      setSelectedId(cultivars[0]?.id ?? '');
      return;
    }
    if (!confirm(`Delete the ${draft?.fields.year ?? ''} ${draft?.fields.name} trial and all its rounds? This can't be undone.`)) return;
    setBusy(true);
    try {
      const r = await call(`/cultivars/${base.id}`, { method: 'PUT', token, body: JSON.stringify({ fields: {}, rounds: {} }) });
      if (r.status === 401) { onSignOut(r.data.error || 'Your session has expired. Sign in again.'); return; }
      if (!r.ok) { setStatus({ kind: 'error', text: r.data.error || 'Delete failed.' }); return; }
      setEdits((prev) => {
        const next = { ...prev.cultivars };
        delete next[base.id];
        return { ...prev, cultivars: next };
      });
      setSelectedId(cultivars[0]?.id ?? '');
      setStatus({ kind: 'ok', text: 'Trial deleted.' });
    } catch {
      setStatus({ kind: 'error', text: "Couldn't reach the admin service. Nothing was deleted." });
    } finally {
      setBusy(false);
    }
  }

  if (!loaded || !draft || !original || !base) return <p className="text-muted">Loading cultivars…</p>;

  const changedFromSheet = isAdded ? 0 : countChanges(diffEdit(original, draft));
  const removedSheetRounds = isAdded ? [] : original.evals.filter((o) => !draft.evals.some((d) => d.date === o.date));
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
            Only show edited or added ({editedCount})
          </label>
          <button type="button" onClick={() => startNew()} className="mt-3 w-full border border-uf-blue px-3 py-1.5 text-sm font-semibold text-uf-blue hover:bg-ground">
            + New trial
          </button>
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
                    <span className="block truncate text-xs text-muted">
                      {[c.genus, c.year, c.lightExposure, c.status === 'In Basket' ? 'In-basket' : null].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  {(pending?.id === c.id || edits.cultivars[c.id]) && (
                    <span className={`shrink-0 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[.08em] text-white ${
                      c.addedInAdmin ? 'bg-uf-orange' : 'bg-uf-blue'
                    }`}>
                      {pending?.id === c.id ? 'Unsaved' : c.addedInAdmin ? 'Added' : 'Edited'}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
          {list.length === 0 && <li className="p-4 text-sm text-muted">No trials match.</li>}
        </ul>
      </nav>

      {/* ---- edit it ---- */}
      <AddedContext.Provider value={isAdded}>
      <form ref={formRef} onSubmit={save} noValidate aria-label={`Edit ${draft.fields.name || 'new trial'}`} className="min-w-0">
        <div className="flex flex-wrap items-center gap-4 border border-line bg-white p-4">
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={withBase(thumb.thumb ?? thumb.local)} alt="" className="h-16 w-16 object-cover" />
          ) : <span className="h-16 w-16 bg-ground" />}
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-2xl font-bold leading-tight">{draft.fields.name || base.name || 'New trial'}</h2>
            <p className="text-sm text-muted">
              {[draft.fields.genus, draft.fields.year].filter(Boolean).join(' · ')}
              {' · '}
              {isPending
                ? 'New trial, not saved yet'
                : selectedEdit?.updatedAt
                  ? `${isAdded ? 'Added in admin, last saved' : 'Last edited'} ${new Date(selectedEdit.updatedAt).toLocaleString('en-US')}`
                  : 'Spreadsheet values, not edited'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-semibold">
            {!isPending && (
              <button type="button" onClick={() => startNew(draft.fields)} className="text-uf-blue underline underline-offset-4">
                Trial this cultivar again
              </button>
            )}
            {isAdded && (
              <button type="button" disabled={busy} onClick={deleteTrial} className="text-red-700 underline underline-offset-4 disabled:opacity-40">
                {isPending ? 'Cancel new trial' : 'Delete this trial'}
              </button>
            )}
            {!isPending && (
              <Link href={trialHref(base)} target="_blank" className="text-uf-blue underline underline-offset-4">
                View public page ↗
              </Link>
            )}
          </div>
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

              <Field id="f-year" label="Trial year" hint={isAdded ? undefined : 'optional'} error={errors.year}>
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
            {draft.evals.length === 0 && (
              <p className="border border-dashed border-line p-4 text-sm text-muted">No rounds yet. Add the first one below.</p>
            )}
            {draft.evals.map((e, i) => (
              <RoundCard
                key={e.date}
                c={base}
                index={i}
                round={e}
                original={isAdded ? undefined : original.evals.find((o) => o.date === e.date)}
                errors={errors}
                onChange={(patch) => setRound(e.date, patch)}
                onRemove={() => removeRound(e.date)}
              />
            ))}
            {removedSheetRounds.length > 0 && (
              <p className="border-l-4 border-uf-orange pl-2 text-sm text-muted">
                Removed from the spreadsheet&rsquo;s rounds:{' '}
                {removedSheetRounds.map((r, i) => (
                  <span key={r.date}>
                    {i > 0 && ', '}
                    {fmtDate(r.date)}{' '}
                    <button type="button" onClick={() => addRound(r.date)} className="font-semibold text-uf-blue underline underline-offset-2">
                      Put back
                    </button>
                  </span>
                ))}
              </p>
            )}
            <div className="flex flex-wrap items-end gap-3 border border-line bg-ground p-3">
              <Field id="new-round-date" label="Add a round" hint="date of the evaluation" error={errors.newRound}>
                <input
                  id="new-round-date" type="date" value={newRoundDate}
                  onChange={(e) => setNewRoundDate(e.target.value)}
                  className={inputClass}
                />
              </Field>
              <button type="button" onClick={() => addRound(newRoundDate)} className="bg-uf-blue px-4 py-2.5 text-sm font-semibold text-white">
                Add round
              </button>
            </div>
          </Panel>
        </div>

        {/* ---- save bar: always in reach while scrolling a long form ---- */}
        <div className="sticky bottom-0 z-10 mt-6 flex flex-wrap items-center gap-3 border border-line border-t-4 border-t-uf-blue bg-white p-4 shadow-[0_-4px_12px_rgba(0,0,0,.06)]">
          <div className="min-w-0 flex-1 text-sm">
            {status ? (
              <p role={status.kind === 'error' ? 'alert' : 'status'} className={status.kind === 'error' ? errorText : 'font-medium text-uf-blue'}>
                {status.text}{' '}
                {status.link && <Link href={trialHref(base)} className="underline underline-offset-4">View it</Link>}
              </p>
            ) : unsaved ? (
              <p className="font-medium">You have unsaved changes.</p>
            ) : (
              <p className="text-muted">
                {isAdded
                  ? 'Added in the admin page.'
                  : changedFromSheet
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
            {busy ? 'Saving…' : isPending ? 'Save new trial' : 'Save changes'}
          </button>
        </div>
      </form>
      </AddedContext.Provider>
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
  if ((value ?? '') === (current ?? '') || useContext(AddedContext)) return null;
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

function RoundCard({ c, index, round, original, errors, onChange, onRemove }: {
  c: Cultivar; index: number; round: Evaluation; errors: Errors;
  original: Evaluation | undefined;   // the spreadsheet's round; none for an added round
  onChange: (patch: Partial<Evaluation>) => void;
  onRemove: () => void;
}) {
  const img = c.images.find((i) => i.date === round.date && i.mirrored);
  const scoresChanged = !original || CATEGORIES.some((cat) => round[cat.key] !== original[cat.key]);
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
        <button
          type="button" onClick={onRemove}
          aria-label={`Remove the ${fmtDate(round.date)} round`}
          className="ml-1 text-xs font-semibold text-red-700 underline underline-offset-2"
        >
          Remove
        </button>
      </header>

      <div className="grid gap-3 p-3 sm:grid-cols-2">
        {CATEGORIES.map((cat) => {
          const changed = !!original && round[cat.key] !== original[cat.key];
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
                  Spreadsheet: {original![cat.key]?.toFixed(1) ?? 'not scored'}{' '}
                  <button type="button" onClick={() => onChange({ [cat.key]: original![cat.key] })} className="font-semibold text-uf-blue underline underline-offset-2">
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
