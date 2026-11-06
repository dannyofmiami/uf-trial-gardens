// Corrections made in /admin to the spreadsheet data. They're kept in a small JSON file
// (content/cultivar-edits.json) that the site layers on top of the built data in the
// browser, the same way the home page banner works, so an edit shows without a rebuild.

import { useEffect, useState } from 'react';
import { withBase, type Cultivar, type Evaluation, type Scores } from '@/lib/data';
import { ADMIN_DEMO, demoCultivarEdits } from '@admin-demo';

export const EDITS_PATH = '/content/cultivar-edits.json';

export type CultivarFields = Pick<Cultivar, 'name' | 'genus' | 'supplier' | 'flowerColor' | 'year' | 'status'> & {
  lightExposure: string;   // '' when not recorded
};
export type RoundEdit = Partial<Scores> & { notes?: string | null };
export type CultivarEdit = {
  fields: Partial<CultivarFields>;
  rounds: Record<string, RoundEdit>;
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

const withRound = (e: Evaluation, r: RoundEdit | undefined): Evaluation => {
  if (!r) return e;
  const next = { ...e, ...r };
  // only recompute the average when a score changed, so the sheet's own rating stands otherwise
  if (SCORE_KEYS.some((k) => k in r)) next.avg = roundAverage(next);
  return next;
};

export function applyToEvaluations(evals: Evaluation[], edit: CultivarEdit | undefined): Evaluation[] {
  if (!edit) return evals;
  return evals.map((e) => withRound(e, edit.rounds[e.date]));
}

// The cultivar's own fields, plus its current scores when the latest round was edited.
export function applyToCultivar(c: Cultivar, edit: CultivarEdit | undefined): Cultivar {
  if (!edit) return c;
  const { lightExposure, ...rest } = edit.fields;
  const next: Cultivar = { ...c, ...rest };
  if (lightExposure !== undefined) next.lightExposure = lightExposure || undefined;
  const latest = edit.rounds[c.latestEvaluation];
  if (latest && SCORE_KEYS.some((k) => k in latest)) {
    next.latestScores = { ...c.latestScores };
    for (const k of SCORE_KEYS) if (k in latest) next.latestScores[k] = latest[k] ?? null;
    next.currentAvg = roundAverage(next.latestScores);
  }
  return next;
}

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
  for (const o of original.evals) {
    const d = draft.evals.find((e) => e.date === o.date);
    if (!d) continue;
    const r: RoundEdit = {};
    for (const k of SCORE_KEYS) if (d[k] !== o[k]) r[k] = d[k];
    if ((d.notes || null) !== (o.notes || null)) r.notes = d.notes || null;
    if (Object.keys(r).length) rounds[o.date] = r;
  }
  return { fields, rounds };
}

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
