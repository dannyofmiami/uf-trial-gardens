import type { Metadata } from 'next';
import { meta, SCALE } from '@/lib/data';
import { PageHeader, Section, Notice, CategoryLegend } from '@/components/Ui';

export const metadata: Metadata = {
  title: 'About the Program',
  description:
    'Mission, facility, and trial methodology for the UF Public Trial Gardens in Homestead, Florida, USDA Hardiness Zone 11b.',
};

const STAGES = [
  ['Planning & intake', 'Entries are solicited and received from breeders and suppliers during the cooler planning months.'],
  ['Planting', 'Varieties are labeled, mapped, and installed in-ground in side-by-side trial beds.'],
  ['Establishment', 'New plantings settle in under consistent irrigation and care before formal scoring begins.'],
  ['Peak evaluation', 'Recurring ratings continue through the warm season, when heat, humidity, and rainfall test every entry.'],
  ['Reporting', 'Season-long scores are averaged, performance highlights are identified, and results are published.'],
];

export default function About() {
  return (
    <>
      <PageHeader
        eyebrow="About the program"
        title="UF Public Trial Gardens"
        lede={`Independent, side-by-side performance data for the conditions that define South Florida. Homestead, USDA Hardiness Zone ${meta.hardinessZone}.`}
      />

      <Section>
        <h2 className="mt-10 font-display text-3xl font-extrabold tracking-tight">Our mission</h2>
        <p className="mt-4 max-w-3xl text-muted leading-relaxed">
          Purpose of the trial gardens is to what are the plants which really prosper in South
          Florida? The heat, humidity, ultraviolet exposure and heavy rainfall during the season
          create a set of stresses which can only be simulated in bench trials conducted in colder
          and dryer climates. We plant candidate ornamental plants side-by-side in ground and report
          on our observations without bias.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Independent', 'Results are not sponsored or curated. Strong and weak performers are reported alike.'],
            ['Side-by-side', 'Every variety is judged against its neighbors in the same beds, season, and weather.'],
            ['South Florida–specific', `Data reflects Homestead's true heat, humidity, and rainfall (Zone ${meta.hardinessZone}).`],
            ['Public & practical', 'Findings are shared openly so the public and the industry can plant better.'],
          ].map(([h, b]) => (
            <div key={h} className="border border-line bg-white p-5">
              <h3 className="font-semibold">{h}</h3>
              <p className="mt-2 text-sm text-muted leading-relaxed">{b}</p>
            </div>
          ))}
        </div>

        <h2 className="mt-14 font-display text-3xl font-extrabold tracking-tight">The trial year</h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {STAGES.map(([h, b], i) => (
            <li key={h} className="border border-line bg-white p-5">
              <span className="grid h-8 w-8 place-items-center bg-uf-blue text-sm font-bold text-white">
                {i + 1}
              </span>
              <h3 className="mt-3 font-semibold">{h}</h3>
              <p className="mt-2 text-sm text-muted leading-relaxed">{b}</p>
            </li>
          ))}
        </ol>

        <h2 className="mt-14 font-display text-3xl font-extrabold tracking-tight">Trial methodology</h2>
        <p className="mt-3 max-w-3xl text-muted leading-relaxed">
          Every variety is rated on a 1–5 scale across four categories. The average of those four
          scores (the AVG) is the single number that determines award eligibility.
        </p>

        <ul className="mt-6 grid gap-2 sm:grid-cols-5">
          {SCALE.map((s) => (
            <li key={s.v} className="border border-line bg-white px-4 py-3">
              <span className="font-display text-2xl font-bold tabular-nums">{s.v.toFixed(1)}</span>
              <span className="mt-1 block text-sm font-medium">{s.label}</span>
              {s.note && <span className="block text-xs text-muted">{s.note}</span>}
            </li>
          ))}
        </ul>

        <div className="mt-8"><CategoryLegend /></div>
      </Section>
    </>
  );
}
