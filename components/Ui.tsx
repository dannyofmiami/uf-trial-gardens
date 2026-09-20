import Link from 'next/link';
import { CATEGORIES, type Cultivar } from '@/lib/data';
import TrialPhoto from '@/components/TrialPhoto';

export function scoreTone(v: number | null) {
  if (v === null) return 'bg-warm-gray text-ifas-gray';
  if (v >= 4.5) return 'bg-uf-blue text-white';
  if (v >= 3.5) return 'bg-ifas-purple text-white';
  return 'bg-warm-gray text-ifas-gray';
}

export function PageHeader({ eyebrow, title, lede }: { eyebrow?: string; title: string; lede?: string }) {
  return (
    <div className="border-b-4 border-uf-orange bg-white">
      <div className="mx-auto w-full max-w-6xl px-5 py-12">
        {eyebrow && (
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[.16em] text-uf-blue">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-3 font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
          {title}
        </h1>
        {lede && (
          <p className="mt-4 max-w-[62ch] font-serif text-lg leading-relaxed text-muted">{lede}</p>
        )}
      </div>
    </div>
  );
}

export function Section({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`mx-auto w-full max-w-6xl px-5 py-12 ${className}`}>{children}</section>;
}

// orange only as a border, it's too light for text
export function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div role="note" className="border border-l-4 border-line border-l-uf-orange bg-white px-5 py-4">
      <p className="text-sm leading-relaxed text-ifas-gray">{children}</p>
    </div>
  );
}

export function ScoreBar({ value, code, label }: { value: number | null; code: string; label: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm">
          <span className="font-mono text-[11px] font-semibold tracking-[.1em] text-muted">{code}</span>
          <span className="ml-2 text-ifas-gray">{label}</span>
        </span>
        <span className="font-mono text-sm font-semibold tabular-nums">
          {value === null ? '—' : value.toFixed(1)}
        </span>
      </div>
      <div className="mt-1.5 h-2 bg-ground">
        <div className="h-full bg-uf-orange" style={{ width: `${value === null ? 0 : (value / 5) * 100}%` }} />
      </div>
    </div>
  );
}

export function AvgBadge({ value, size = 'md' }: { value: number | null; size?: 'md' | 'lg' }) {
  const dims = size === 'lg' ? 'h-20 w-20 text-3xl' : 'h-12 w-12 text-base';
  return (
    <span
      className={`${dims} ${scoreTone(value)} grid shrink-0 place-items-center font-display font-bold tabular-nums`}
      aria-label={value === null ? 'Not yet scored' : `Average score ${value.toFixed(1)} of 5`}
    >
      {value === null ? '—' : value.toFixed(1)}
    </span>
  );
}

export function CultivarCard({ c }: { c: Cultivar }) {
  return (
    <Link
      href={`/trial-gardens/${c.id}/`}
      className="group flex flex-col border border-line bg-white transition hover:border-uf-orange"
    >
      <div className="relative">
        <TrialPhoto c={c} variant="card" className="h-40 w-full" />
        <span className="absolute right-0 top-0">
          <AvgBadge value={c.currentAvg} />
        </span>
      </div>
      <div className="flex-1 p-4">
        <p className="font-display font-bold leading-snug group-hover:text-uf-blue">{c.name}</p>
        <p className="mt-1 text-sm text-muted">
          {c.genus}
          {c.flowerColor ? ` · ${c.flowerColor}` : ''}
        </p>
        <p className="mt-2 font-mono text-[11px] uppercase tracking-[.06em] text-muted">
          {c.supplier ?? 'Supplier not recorded'}
        </p>
      </div>
    </Link>
  );
}

export function CategoryLegend() {
  return (
    <dl className="grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-4">
      {CATEGORIES.map((cat) => (
        <div key={cat.key} className="bg-white p-5">
          <dt>
            <span className="font-mono text-[11px] font-semibold tracking-[.14em] text-uf-blue">
              {cat.code}
            </span>
            <span className="mt-2 block font-display text-base font-bold">{cat.label}</span>
          </dt>
          <dd className="mt-2 text-sm leading-relaxed text-muted">{cat.blurb}</dd>
        </div>
      ))}
    </dl>
  );
}
