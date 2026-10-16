'use client';

import { useState } from 'react';
import { CultivarCard } from '@/components/Ui';
import type { Cultivar } from '@/lib/data';

type Props = { cultivars: Cultivar[]; genera: string[]; suppliers: string[]; colors: string[] };

// Light exposure isn't in the trial data yet, so this filter matches nothing until it is.
const LIGHT = ['Full sun', 'Partial Shade'];
// Planting type reads each cultivar's status ('In Ground' today).
const PLANTING = [
  { value: 'inground', label: 'In-ground' },
  { value: 'inbasket', label: 'In-basket' },
];
const plantingKey = (status: string) => status.toLowerCase().replace(/[^a-z]/g, '');

type SortKey = 'avg' | 'name' | 'genus';

export default function DatabaseBrowser({ cultivars, genera, suppliers, colors }: Props) {
  const [q, setQ] = useState('');
  const [genus, setGenus] = useState('');
  const [supplier, setSupplier] = useState('');
  const [color, setColor] = useState('');
  const [light, setLight] = useState('');
  const [planting, setPlanting] = useState('');
  const [minAvg, setMinAvg] = useState(0);
  const [sort, setSort] = useState<SortKey>('avg');

  const needle = q.trim().toLowerCase();

  const results = cultivars.filter((c) => {
    if (genus && c.genus !== genus) return false;
    if (supplier && c.supplier !== supplier) return false;
    if (color && c.flowerColor !== color) return false;
    if (light && c.lightExposure !== light) return false;
    if (planting && plantingKey(c.status) !== planting) return false;
    if (minAvg && (c.currentAvg ?? 0) < minAvg) return false;
    if (needle) {
      const text = `${c.name} ${c.genus} ${c.supplier ?? ''} ${c.flowerColor ?? ''}`.toLowerCase();
      if (!text.includes(needle)) return false;
    }
    return true;
  });

  results.sort((a, b) => {
    if (sort === 'name') return a.name.localeCompare(b.name);
    if (sort === 'genus') return a.genus.localeCompare(b.genus) || a.name.localeCompare(b.name);
    return (b.currentAvg ?? 0) - (a.currentAvg ?? 0) || a.name.localeCompare(b.name);
  });

  const reset = () => {
    setQ(''); setGenus(''); setSupplier(''); setColor(''); setLight(''); setPlanting('');
    setMinAvg(0); setSort('avg');
  };
  const active = q || genus || supplier || color || light || planting || minAvg;

  // say why a filter came up empty when it's for data that hasn't been recorded
  const emptyReason =
    light && !cultivars.some((c) => c.lightExposure)
      ? "Light exposure hasn't been recorded for these cultivars yet."
      : planting && !cultivars.some((c) => plantingKey(c.status) === planting)
        ? `No cultivars in this trial are planted ${planting === 'inbasket' ? 'in baskets' : 'in the ground'}.`
        : 'No cultivars match those filters.';

  const field = 'border border-line bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-uf-blue';
  const legend = 'font-mono text-[10px] font-semibold uppercase tracking-[.12em] text-muted';

  return (
    <div>
      <div className="border border-line bg-white p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="lg:col-span-2 flex flex-col gap-1">
            <span className={legend}>Search</span>
            <input
              type="search" value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Cultivar, genus, supplier, or color" className={field}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className={legend}>Genus</span>
            <select value={genus} onChange={(e) => setGenus(e.target.value)} className={field}>
              <option value="">All genera</option>
              {genera.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className={legend}>Supplier</span>
            <select value={supplier} onChange={(e) => setSupplier(e.target.value)} className={field}>
              <option value="">All suppliers</option>
              {suppliers.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className={legend}>Flower color</span>
            <select value={color} onChange={(e) => setColor(e.target.value)} className={field}>
              <option value="">All colors</option>
              {colors.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className={legend}>Light exposure</span>
            <select value={light} onChange={(e) => setLight(e.target.value)} className={field}>
              <option value="">Any light</option>
              {LIGHT.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className={legend}>Planting type</span>
            <select value={planting} onChange={(e) => setPlanting(e.target.value)} className={field}>
              <option value="">All planting types</option>
              {PLANTING.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className={legend}>Sort by</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className={field}>
              <option value="avg">Highest AVG</option>
              <option value="name">Cultivar name</option>
              <option value="genus">Genus</option>
            </select>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className={`${legend} mr-1`}>Minimum AVG</span>
          {[0, 3, 4, 4.5].map((v) => (
            <button
              key={v} type="button" onClick={() => setMinAvg(v)}
              aria-pressed={minAvg === v}
              className={`border px-3 py-1 font-mono text-xs transition ${
                minAvg === v ? 'border-uf-blue bg-uf-blue text-white' : 'border-line hover:border-uf-orange'
              }`}
            >
              {v === 0 ? 'Any' : `${v}+`}
            </button>
          ))}
          {active ? (
            <button type="button" onClick={reset} className="ml-auto text-xs font-medium text-uf-blue underline">
              Clear filters
            </button>
          ) : null}
        </div>
      </div>

      <p className="mt-6 font-mono text-xs uppercase tracking-[.08em] text-muted" role="status" aria-live="polite">
        Showing <strong className="text-ink">{results.length}</strong> of {cultivars.length} cultivars
      </p>

      {results.length === 0 ? (
        <p className="mt-8 border border-dashed border-line p-12 text-center text-muted">
          {emptyReason}
        </p>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {results.map((c) => <CultivarCard key={c.id} c={c} />)}
        </div>
      )}
    </div>
  );
}
