import type { Metadata } from 'next';
import Link from 'next/link';
import { cultivars, facets, withBase } from '@/lib/data';
import { PageHeader, Section } from '@/components/Ui';

export const metadata: Metadata = {
  title: 'Industry Partners',
  description: 'The breeders, suppliers, and plant sources behind the UF public trial.',
};

// logos come from each company's own site, they still need a branding review before launch
const LOGOS: Record<string, string> = {
  BallFloral: '/partners/ballfloral.png',
  Benary: '/partners/benary.svg',
  Danziger: '/partners/danziger.png',
  'Dummen Orange': '/partners/dummen-orange.png',
  PanAmerican: '/partners/panamerican.svg',
  Selecta: '/partners/selecta.svg',
};

export default function Partners() {
  const bySupplier = facets.suppliers
    .map((s) => {
      const entries = cultivars.filter((c) => c.supplier === s);
      const scored = entries.filter((c) => c.currentAvg !== null);
      const avg = scored.length
        ? scored.reduce((sum, c) => sum + (c.currentAvg ?? 0), 0) / scored.length
        : null;
      const genera = [...new Set(entries.map((c) => c.genus))].sort();
      return { name: s, count: entries.length, avg, genera };
    })
    .sort((a, b) => b.count - a.count);

  return (
    <>
      <PageHeader
        eyebrow="Our network"
        title="Industry Partners"
        lede="The breeders and suppliers whose entries make up the current trial, with what each contributed this season."
      />
      <Section>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {bySupplier.map((s) => (
            <div key={s.name} className="border border-line bg-white p-5">
              <div className="flex h-14 items-center">
                {LOGOS[s.name] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={withBase(LOGOS[s.name])}
                    alt={`${s.name} logo`}
                    className="max-h-14 max-w-[180px] object-contain"
                    loading="lazy"
                  />
                ) : (
                  <span className="font-mono text-xs uppercase tracking-[.12em] text-muted">{s.name}</span>
                )}
              </div>
              <div className="mt-4 flex items-baseline justify-between gap-3">
                <h2 className="font-display text-lg font-bold">{s.name}</h2>
                <span className="bg-uf-blue px-3 py-1 text-xs font-semibold text-white">
                  {s.count} {s.count === 1 ? 'entry' : 'entries'}
                </span>
              </div>
              <p className="mt-2 text-sm text-muted">
                Average AVG across entries: <strong className="text-ink tabular-nums">{s.avg?.toFixed(2) ?? '—'}</strong>
              </p>
              <p className="mt-3 text-sm text-muted leading-relaxed">
                <span className="font-medium text-ink">Genera:</span> {s.genera.join(', ')}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-8 text-sm text-muted">
          Browse every entry in the{' '}
          <Link href="/trial-gardens/" className="font-semibold text-uf-blue underline underline-offset-4">
            Trial Gardens Database
          </Link>.
        </p>
        <p className="mt-4 text-xs text-muted">
          Logos are trademarks of their respective owners, sourced from each company&apos;s own official
          site for source identification. Confirm usage with each supplier as part of the UF/IFAS
          branding review before public launch.
        </p>
      </Section>
    </>
  );
}
