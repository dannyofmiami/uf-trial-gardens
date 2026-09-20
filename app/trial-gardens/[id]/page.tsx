import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  cultivars, getCultivar, getEvaluations, meta, CATEGORIES, fmtDate,
} from '@/lib/data';
import { Section, Notice, ScoreBar, AvgBadge } from '@/components/Ui';
import TrialPhoto from '@/components/TrialPhoto';

type Params = { id: string };

// makes one page per cultivar
export function generateStaticParams(): Params[] {
  return cultivars.map((c) => ({ id: c.id }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { id } = await params;
  const c = getCultivar(id);
  if (!c) return {};
  return {
    title: `${c.name} (${c.genus})`,
    description: `Trial performance for ${c.name} (${c.genus}), supplied by ${c.supplier ?? 'an unrecorded supplier'}. ${c.evaluationCount} evaluations at the UF/IFAS Public Trial Gardens, Homestead, FL.`,
  };
}

export default async function CultivarPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const c = getCultivar(id);
  if (!c) notFound();

  const evals = getEvaluations(id);
  const latest = evals[0];

  return (
    <>
      <div className="border-b-4 border-uf-orange bg-white">
        <div className="mx-auto w-full max-w-6xl px-5 py-8">
          <Link
            href="/trial-gardens/"
            className="font-mono text-[11px] uppercase tracking-[.12em] text-uf-blue underline-offset-4 hover:underline"
          >
            ← Trial gardens database
          </Link>

          <div className="mt-6 grid gap-8 lg:grid-cols-[320px_1fr]">
            <TrialPhoto c={c} className="aspect-[4/3] w-full" />

            <div>
              <p className="font-mono text-[11px] uppercase tracking-[.12em] text-muted">
                UF/IFAS TREC · {meta.site} · USDA Zone {meta.hardinessZone}
              </p>
              <h1 className="mt-2 font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
                {c.name}
              </h1>
              <p className="mt-2 font-serif text-xl text-muted">{c.genus}</p>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <AvgBadge value={c.currentAvg} size="lg" />
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[.12em] text-muted">
                    Current AVG
                  </p>
                  <p className="text-sm text-muted">
                    across {c.evaluationCount} evaluations · latest {fmtDate(c.latestEvaluation)}
                  </p>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {[c.status, c.flowerColor, c.supplier ? `Supplier: ${c.supplier}` : null]
                  .filter(Boolean)
                  .map((chip) => (
                    <span key={chip as string} className="border border-line px-3 py-1 font-mono text-[11px] text-muted">
                      {chip}
                    </span>
                  ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Section>
        {latest && (
          <div className="border border-line bg-white p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-xl font-bold">Latest evaluation</h2>
              <p className="font-mono text-sm text-muted">{fmtDate(latest.date)}</p>
            </div>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              {CATEGORIES.map((cat) => (
                <ScoreBar key={cat.key} value={latest[cat.key]} code={cat.code} label={cat.label} />
              ))}
            </div>
          </div>
        )}

        <h2 className="mt-12 font-display text-xl font-bold">Round-by-round history</h2>
        <p className="mt-1 text-sm text-muted">
          Every dated evaluation with its four category scores. Most recent first.
        </p>

        {/* [ifas] .stack on every table, .table-scroll when it's wide */}
        <div className="table-scroll mt-4 border border-line bg-white">
          <table className="stack w-full min-w-[560px] text-sm">
            <caption className="border-b border-line px-4 py-3 text-left text-sm text-muted">
              Evaluation history for {c.name}
            </caption>
            <thead className="bg-ground text-left">
              <tr>
                <th scope="col" className="px-4 py-3 font-mono text-[11px] uppercase tracking-[.1em]">Round</th>
                {CATEGORIES.map((cat) => (
                  <th key={cat.key} scope="col" className="px-4 py-3 font-mono text-[11px] uppercase tracking-[.1em]" title={cat.label}>
                    {cat.code}
                  </th>
                ))}
                <th scope="col" className="px-4 py-3 font-mono text-[11px] uppercase tracking-[.1em]">AVG</th>
              </tr>
            </thead>
            <tbody>
              {evals.map((e) => (
                <tr key={e.date} className="border-t border-line">
                  <th scope="row" data-label="Round" className="whitespace-nowrap px-4 py-3 text-left font-medium">
                    {fmtDate(e.date)}
                  </th>
                  {CATEGORIES.map((cat) => (
                    <td key={cat.key} data-label={cat.label} className="px-4 py-3 font-mono tabular-nums">
                      {e[cat.key]?.toFixed(1) ?? '—'}
                    </td>
                  ))}
                  <td data-label="Average" className="px-4 py-3 font-mono font-bold tabular-nums">
                    {e.avg?.toFixed(1) ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-8">
          <Notice>
            The source export carries no observation notes, weather readings or flower color for
            this cultivar. All three fields exist in the data model and populate as soon as the
            trial team supplies them.{' '}
            {c.images.length > 0 && !c.images[0].mirrored &&
              'The photo above is hotlinked from Dropbox, run npm run mirror to serve it from UF-controlled storage.'}
          </Notice>
        </div>
      </Section>
    </>
  );
}
