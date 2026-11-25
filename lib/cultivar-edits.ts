// Corrections made in /admin to the spreadsheet data. They're kept in a small JSON file
// (content/cultivar-edits.json) that the site layers on top of the built data in the
// browser, the same way the home page banner works, so an edit shows without a rebuild.
//
// Each entry is one trial: a cultivar in a given year, light exposure and planting type.
// Besides corrections, /admin can add and remove evaluation rounds, and add whole new
// trials (e.g. the same cultivar again in 2027), which have no spreadsheet row behind them.

import { useEffect, useState } from 'react';
import { getEvaluations, withBase, type Cultivar, type Evaluation, type Scores } from '@/lib/data';
import { ADMIN_DEMO, demoCultivarEdits } from '@admin-demo';

export const EDITS_PATH = '/content/cultivar-edits.json';

export type CultivarFields = Pick<Cultivar, 'name' | 'genus' | 'supplier' | 'flowerColor' | 'year' | 'status'> & {
  lightExposure: string;   // '' when not recorded
};
export type RoundEdit = Partial<Scores> & { notes?: string | null };
export type CultivarEdit = {
  fields: Partial<CultivarFields>;
  rounds: Record<string, RoundEdit>;   // keyed by date; a date not in the sheet is an added round
  removedRounds?: string[];            // spreadsheet rounds taken out
  added?: boolean;                     // a trial created in /admin
  updatedAt?: string;
};
export type EditsFile = { cultivars: Record<string, CultivarEdit>; updatedAt?: string };

export const EMPTY_EDITS: EditsFile = { cultivars: {} };

const SCORE_KEYS = ['heatResistance', 'uniformity', 'flowerPower', 'foliage'] as const;

// same rule as the import: the mean of the scored categories, to two places
export function roundAverage(s: Partial<Scores>): number | null {
  const vals = SCORE_KEYS.map((k) => s[k]).filter((v): v is number => typeof v === 'number');
  return vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100 : null;
}

export function fieldsOf(c: Cultivar): CultivarFields {
  return {
    name: c.name, genus: c.genus, supplier: c.supplier, flowerColor: c.flowerColor,
    year: c.year, status: c.status, lightExposure: c.lightExposure ?? '',
  };
}

const NO_SCORES: Scores = { heatResistance: null, uniformity: null, flowerPower: null, foliage: null };

const withRound = (e: Evaluation, r: RoundEdit | undefined): Evaluation => {
  if (!r) return e;
  const next = { ...e, ...r };
  // only recompute the average when a score changed, so the sheet's own rating stands otherwise
  if (SCORE_KEYS.some((k) => k in r)) next.avg = roundAverage(next);
  return next;
};

export const blankRound = (cultivarId: string, date: string): Evaluation =>
  ({ cultivarId, date, ...NO_SCORES, avg: null, notes: null, weather: null });

// The rounds as shown: spreadsheet rounds (corrected, minus removed ones) plus added rounds,
// newest first unless asked otherwise.
export function applyToEvaluations(
  evals: Evaluation[], edit: CultivarEdit | undefined, order: 'newest' | 'oldest' = 'newest',
): Evaluation[] {
  if (!edit) return evals;
  const removed = new Set(edit.removedRounds ?? []);
  const known = new Set(evals.map((e) => e.date));
  const out = evals.filter((e) => !removed.has(e.date)).map((e) => withRound(e, edit.rounds[e.date]));
  const cultivarId = evals[0]?.cultivarId ?? '';
  for (const [date, r] of Object.entries(edit.rounds)) {
    if (!known.has(date)) out.push(withRound(blankRound(cultivarId, date), r));
  }
  return out.sort((a, b) => (order === 'newest' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)));
}

const touchesRounds = (edit: CultivarEdit) =>
  !!edit.removedRounds?.length || Object.values(edit.rounds).some((r) => Object.keys(r).length);

// The trial's own fields, plus its summary (latest round, AVG, count) when rounds changed.
export function applyToCultivar(c: Cultivar, edit: CultivarEdit | undefined): Cultivar {
  if (!edit) return c;
  const { lightExposure, ...rest } = edit.fields;
  const next: Cultivar = { ...c, ...rest };
  if (lightExposure !== undefined) next.lightExposure = lightExposure || undefined;
  if (edit.added) next.addedInAdmin = true;
  if (touchesRounds(edit) || edit.added) {
    const evals = applyToEvaluations(getEvaluations(c.id), edit);
    const latest = evals[0];
    next.evaluationCount = evals.length;
    next.latestEvaluation = latest?.date ?? '';
    next.latestScores = latest ? Object.fromEntries(SCORE_KEYS.map((k) => [k, latest[k]])) as Scores : { ...NO_SCORES };
    next.currentAvg = latest?.avg ?? null;
  }
  return next;
}

// A trial added in /admin, built from its saved edit.
export function addedCultivar(id: string, edit: CultivarEdit): Cultivar {
  const blank: Cultivar = {
    id, name: '', genus: '', supplier: null, flowerColor: null, year: null, images: [],
    status: 'In Ground', currentAvg: null, latestEvaluation: '', evaluationCount: 0, latestScores: { ...NO_SCORES },
  };
  return applyToCultivar(blank, edit);
}

// Every trial as the public sees it: the spreadsheet's, corrected, then the added ones.
export function allCultivars(built: Cultivar[], edits: EditsFile): Cultivar[] {
  const added = Object.entries(edits.cultivars)
    .filter(([, e]) => e.added)
    .map(([id, e]) => addedCultivar(id, e))
    .sort((a, b) => a.name.localeCompare(b.name));
  return [...built.map((c) => applyToCultivar(c, edits.cultivars[c.id])), ...added];
}

const roundValues = (e: Evaluation): RoundEdit =>
  ({ ...Object.fromEntries(SCORE_KEYS.map((k) => [k, e[k]])), notes: e.notes || null });

// What differs between the spreadsheet values and the admin's draft -- that's all that's saved.
export function diffEdit(
  original: { fields: CultivarFields; evals: Evaluation[] },
  draft: { fields: CultivarFields; evals: Evaluation[] },
): CultivarEdit {
  const fields: Partial<CultivarFields> = {};
  for (const k of Object.keys(original.fields) as (keyof CultivarFields)[]) {
    if (draft.fields[k] !== original.fields[k]) (fields as Record<string, unknown>)[k] = draft.fields[k];
  }
  const rounds: Record<string, RoundEdit> = {};
  const removedRounds: string[] = [];
  for (const o of original.evals) {
    const d = draft.evals.find((e) => e.date === o.date);
    if (!d) { removedRounds.push(o.date); continue; }
    const r: RoundEdit = {};
    for (const k of SCORE_KEYS) if (d[k] !== o[k]) r[k] = d[k];
    if ((d.notes || null) !== (o.notes || null)) r.notes = d.notes || null;
    if (Object.keys(r).length) rounds[o.date] = r;
  }
  for (const d of draft.evals) {
    if (!original.evals.some((o) => o.date === d.date)) rounds[d.date] = roundValues(d);
  }
  return removedRounds.length ? { fields, rounds, removedRounds } : { fields, rounds };
}

// An added trial is saved whole: all its fields and every round.
export const fullEdit = (draft: { fields: CultivarFields; evals: Evaluation[] }): CultivarEdit => ({
  added: true,
  fields: { ...draft.fields },
  rounds: Object.fromEntries(draft.evals.map((e) => [e.date, roundValues(e)])),
});

export async function loadCultivarEdits(): Promise<EditsFile> {
  // demo build: edits saved in this browser's /admin (see lib/admin-demo.ts)
  if (ADMIN_DEMO) return demoCultivarEdits() ?? EMPTY_EDITS;
  try {
    const r = await fetch(withBase(EDITS_PATH), { cache: 'no-store' });
    const data = r.ok ? await r.json() : null;
    return data && typeof data.cultivars === 'object' ? data : EMPTY_EDITS;
  } catch {
    return EMPTY_EDITS;
  }
}

// The edits for the public pages: none until loaded, so the built data shows first.
export function useCultivarEdits(): EditsFile {
  const [edits, setEdits] = useState<EditsFile>(EMPTY_EDITS);
  useEffect(() => {
    let cancelled = false;
    loadCultivarEdits().then((e) => { if (!cancelled) setEdits(e); });
    return () => { cancelled = true; };
  }, []);
  return edits;
}
