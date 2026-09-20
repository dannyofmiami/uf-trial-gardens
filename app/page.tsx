import Link from 'next/link';
import { cultivars, facets, meta, SCALE } from '@/lib/data';
import { Section, CategoryLegend, CultivarCard } from '@/components/Ui';

export default function Home() {
  const top = [...cultivars].sort((a, b) => (b.currentAvg ?? 0) - (a.currentAvg ?? 0)).slice(0, 8);

  return (
    <>
      <div className="border-b-4 border-uf-orange bg-white">
        <div className="mx-auto w-full max-w-6xl px-5 py-16">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[.16em] text-uf-blue">
            Florida&rsquo;s tropical trial site
          </p>
          <h1 className="mt-4 max-w-4xl font-display text-4xl font-extrabold leading-[1.04] tracking-tight sm:text-6xl">
            Independent performance data for plants that have to survive summer.
          </h1>
          <p className="mt-5 max-w-[62ch] font-serif text-lg leading-relaxed text-muted">
            Ornamental cultivars grown in the ground, side by side, through Homestead&rsquo;s heat,
            humidity and rainfall, then scored on the same 1–5 scale and published without
            favoring any supplier or brand.
          </p>

          <div className="mt-8">
            <Link
              href="/trial-gardens/"
              className="bg-uf-blue px-6 py-3 font-semibold text-white hover:bg-uf-blue-dk"
            >
              Explore trial results
            </Link>
          </div>

          <dl className="mt-14 grid max-w-3xl gap-8 sm:grid-cols-4">
            {[
              [meta.cultivarCount, 'cultivars in trial'],
              [facets.genera.length, 'genera represented'],
              [facets.suppliers.length, 'suppliers contributing'],
              [facets.dates.length, 'evaluation rounds'],
            ].map(([n, label]) => (
              <div key={label as string}>
                <dt className="font-display text-4xl font-extrabold tabular-nums text-uf-blue">{n}</dt>
                <dd className="mt-1 text-sm text-muted">{label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <Section className="pt-0">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[.16em] text-uf-blue">
          How we score
        </p>
        <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight">
          A 1–5 rating across four categories
        </h2>
        <p className="mt-3 max-w-[62ch] font-serif text-lg leading-relaxed text-muted">
          Every cultivar is evaluated on a 1–5 scale across four categories. The average of all
          four (the AVG) determines performance ranking.
        </p>

        <div className="mt-8"><CategoryLegend /></div>

        <ol className="mt-px grid gap-px bg-line sm:grid-cols-5">
          {SCALE.map((s) => (
            <li key={s.v} className="bg-white px-4 py-3">
              <span className="font-display text-2xl font-bold tabular-nums">{s.v.toFixed(1)}</span>
              <span className="mt-0.5 block text-sm font-semibold">{s.label}</span>
              {s.note && <span className="block text-xs text-muted">{s.note}</span>}
            </li>
          ))}
        </ol>
      </Section>

      <Section className="pt-0">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[.16em] text-uf-blue">
              From the trial beds
            </p>
            <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight">
              Top performers right now
            </h2>
            <p className="mt-2 text-muted">
              A snapshot from the {facets.dates.at(-1)} evaluation, updated biweekly to monthly
              depending on weather.
            </p>
          </div>
          <Link href="/trial-gardens/" className="font-semibold text-uf-blue underline underline-offset-4">
            Browse all {meta.cultivarCount} cultivars →
          </Link>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {top.map((c) => <CultivarCard key={c.id} c={c} />)}
        </div>
      </Section>
    </>
  );
}
