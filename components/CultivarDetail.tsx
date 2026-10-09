'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import {
  fmtDate, imageForDate, latestMirroredImage, withBase, CATEGORIES,
  type Cultivar, type Evaluation, type TrialData,
} from '@/lib/data';
import { Section, ScoreBar, AvgBadge } from '@/components/Ui';
import TrialPhoto from '@/components/TrialPhoto';
import PhotoLightbox from '@/components/PhotoLightbox';
import { weatherForDate, WEATHER_SOURCE } from '@/lib/weather';

export default function CultivarDetail({
  c, evals, meta,
}: { c: Cultivar; evals: Evaluation[]; meta: TrialData['meta'] }) {
  const latest = evals[0];
  const [selectedDate, setSelectedDate] = useState(
    latestMirroredImage(c)?.date ?? latest?.date,
  );
  const heroImage = selectedDate ? imageForDate(c, selectedDate) : undefined;
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const heroButton = useRef<HTMLButtonElement>(null);
  // whatever opened the viewer (hero photo or a round row) gets focus back on close
  const opener = useRef<HTMLElement | null>(null);
  const openLightbox = (from: HTMLElement) => {
    opener.current = from;
    setLightboxOpen(true);
  };
  const closeLightbox = () => {
    setLightboxOpen(false);
    (opener.current ?? heroButton.current)?.focus();
  };
  // a round with a photo opens it full screen; one without just becomes the selection
  const openRound = (date: string, row: HTMLElement) => {
    setSelectedDate(date);
    if (imageForDate(c, date)?.mirrored) openLightbox(row);
  };

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
            <div>
              {heroImage?.mirrored ? (
                <>
                  <button
                    ref={heroButton}
                    type="button"
                    onClick={(ev) => openLightbox(ev.currentTarget)}
                    aria-label={`View larger photo of ${c.name}, ${fmtDate(heroImage.date)}`}
                    className="block w-full cursor-zoom-in focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uf-blue"
                  >
                    <TrialPhoto c={c} image={heroImage} className="aspect-[4/3] w-full" />
                  </button>
                  <PhotoLightbox
                    open={lightboxOpen}
                    onClose={closeLightbox}
                    src={withBase(heroImage.local)}
                    alt={`${c.name} (${c.genus}), photographed ${fmtDate(heroImage.date)}`}
                    caption={`${c.name} · ${fmtDate(heroImage.date)}`}
                  >
                    <PhotoFacts date={heroImage.date} e={evals.find((e) => e.date === heroImage.date)} />
                  </PhotoLightbox>
                </>
              ) : (
                <TrialPhoto c={c} image={heroImage} className="aspect-[4/3] w-full" />
              )}
              {selectedDate && (
                <p className="mt-2 font-mono text-[11px] uppercase tracking-[.1em] text-muted">
                  {selectedDate === latestMirroredImage(c)?.date ? 'Latest photo' : 'Showing'}
                  {' · '}
                  {fmtDate(selectedDate)}
                </p>
              )}
            </div>

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

              {meta.sponsors.length > 0 && (
                <ul className="mt-4 space-y-1 text-sm text-muted">
                  {meta.sponsors.map((s) => (
                    <li key={s.name}>
                      {s.credit}{' '}
                      <a
                        href={s.url}
                        target="_blank"
                        rel="sponsored noopener noreferrer"
                        className="font-semibold text-uf-blue underline underline-offset-4"
                      >
                        {s.name}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
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

        <h2 className="mt-12 font-display text-xl font-bold">History</h2>
        <p className="mt-1 text-sm text-muted">
          Every dated evaluation with its four category scores. Click a round to view its photo full
          screen, along with that round&rsquo;s scores and the weather that day.
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
                <th scope="col" className="px-4 py-3 font-mono text-[11px] uppercase tracking-[.1em]">Photo</th>
                {CATEGORIES.map((cat) => (
                  <th key={cat.key} scope="col" className="px-4 py-3 font-mono text-[11px] uppercase tracking-[.1em]" title={cat.label}>
                    {cat.code}
                  </th>
                ))}
                <th scope="col" className="px-4 py-3 font-mono text-[11px] uppercase tracking-[.1em]">AVG</th>
              </tr>
            </thead>
            <tbody>
              {evals.map((e) => {
                const selected = e.date === selectedDate;
                const hasPhoto = !!imageForDate(c, e.date)?.mirrored;
                return (
                  <tr
                    key={e.date}
                    role="button"
                    tabIndex={0}
                    aria-pressed={selected}
                    aria-label={hasPhoto
                      ? `View the photo from the ${fmtDate(e.date)} round full screen`
                      : `Select the ${fmtDate(e.date)} round (no photo on file)`}
                    onClick={(ev) => openRound(e.date, ev.currentTarget)}
                    onKeyDown={(ev) => {
                      if (ev.key === 'Enter' || ev.key === ' ') {
                        ev.preventDefault();
                        openRound(e.date, ev.currentTarget);
                      }
                    }}
                    className={`${hasPhoto ? 'cursor-zoom-in' : 'cursor-pointer'} border-t border-line transition hover:bg-ground ${selected ? 'bg-ground' : ''}`}
                  >
                    <th scope="row" data-label="Round" className="whitespace-nowrap px-4 py-3 text-left font-medium">
                      {fmtDate(e.date)}
                      {selected && <span className="ml-2 text-uf-blue">●</span>}
                    </th>
                    <td data-label="Photo" className="px-4 py-3">
                      <TrialPhoto
                        c={c}
                        variant="round"
                        image={imageForDate(c, e.date)}
                        className="h-14 w-14"
                      />
                    </td>
                    {CATEGORIES.map((cat) => (
                      <td key={cat.key} data-label={cat.label} className="px-4 py-3 font-mono tabular-nums">
                        {e[cat.key]?.toFixed(1) ?? '—'}
                      </td>
                    ))}
                    <td data-label="Average" className="px-4 py-3 font-mono font-bold tabular-nums">
                      {e.avg?.toFixed(1) ?? '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  );
}

// Under the enlarged photo: that day's weather and the round's scores, side by side
function PhotoFacts({ date, e }: { date: string; e: Evaluation | undefined }) {
  const w = weatherForDate(date);
  return (
    <div className={`grid w-[min(34rem,calc(100vw-2rem))] gap-px border border-white/20 bg-white/20 ${w ? 'grid-cols-2' : 'grid-cols-1'}`}>
      {w && (
        <FactPanel
          title="Weather that day"
          footnote={WEATHER_SOURCE}
          rows={[
            { label: 'High', value: w.highF === null ? null : `${Math.round(w.highF)}°F` },
            { label: 'Low', value: w.lowF === null ? null : `${Math.round(w.lowF)}°F` },
            { label: 'Rain', value: w.rainIn === null ? null : `${w.rainIn.toFixed(2)} in` },
            { label: 'Humidity', value: w.humidityPct === null ? null : `${w.humidityPct}%` },
            {
              label: 'Sunlight', value: w.dli === null ? null : `${w.dli} DLI`,
              title: 'Daily light integral: mol/m² of light over the day (estimated from solar radiation)',
            },
          ]}
        />
      )}
      {e && e.avg !== null ? (
        <FactPanel
          title="Scores this round"
          rows={[
            ...CATEGORIES.map((cat) => ({ label: cat.label, value: e[cat.key]?.toFixed(1) ?? '—' })),
            { label: 'Average', value: e.avg.toFixed(1), strong: true },
          ]}
        />
      ) : (
        <div className="bg-black p-3">
          <p className="font-mono text-[10px] uppercase tracking-[.12em] text-white/60">Scores this round</p>
          <p className="mt-2 text-sm text-white/70">Not yet scored this round</p>
        </div>
      )}
    </div>
  );
}

function FactPanel({ title, footnote, rows }: {
  title: string;
  footnote?: string;
  rows: { label: string; value: string | null; title?: string; strong?: boolean }[];
}) {
  return (
    <div className="flex flex-col bg-black p-3 [@media(max-height:500px)]:px-3 [@media(max-height:500px)]:py-1.5">
      <p className="font-mono text-[10px] uppercase tracking-[.12em] text-white/60">{title}</p>
      <dl className="mt-1.5 space-y-0.5 [@media(max-height:500px)]:mt-0.5 [@media(max-height:500px)]:space-y-0">
        {rows.filter((r) => r.value !== null).map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-3" title={r.title}>
            <dt className="text-xs text-white/70">{r.label}</dt>
            <dd className={`font-mono tabular-nums ${r.strong ? 'text-base font-bold' : 'text-sm'} [@media(max-height:500px)]:text-xs`}>{r.value}</dd>
          </div>
        ))}
      </dl>
      {footnote && <p className="mt-auto pt-2 text-[10px] text-white/50 [@media(max-height:500px)]:pt-0.5">{footnote}</p>}
    </div>
  );
}
