import type { Metadata } from 'next';
import { meta } from '@/lib/data';
import { PageHeader, Section } from '@/components/Ui';

export const metadata: Metadata = {
  title: 'Visit & Contact',
  description: 'Plan a visit to the UF Public Trial Gardens in Homestead, Florida, and get in touch with the trial team.',
};

export default function Visit() {
  return (
    <>
      <PageHeader
        eyebrow="Plan your visit"
        title="Visit & Contact"
        lede={`The trial gardens are a public planting designed for walking tours. Homestead, Florida, USDA Hardiness Zone ${meta.hardinessZone}.`}
      />
      <Section>
        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <div>
            <h2 className="font-display text-2xl font-bold">Visiting the gardens</h2>
            <dl className="mt-5 space-y-4">
              {[
                ['Location', '18905 SW 280th St., Homestead, FL 33031'],
                ['Hours', 'Mon–Fri: 8 AM–5 PM | Sat–Sun: Closed'],
                ['Admission', 'Free and open to the public'],
                ['Group tours', 'Industry and group tours arranged with the trial manager'],
                ['Best season', 'Peak evaluation runs through the warm season'],
              ].map(([k, v]) => (
                <div key={k} className="border-b border-line pb-3">
                  <dt className="text-xs uppercase tracking-wide text-muted">{k}</dt>
                  <dd className="mt-1 font-medium">{v}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-6 aspect-[4/3] w-full border border-line">
              <iframe
                title="Map to the UF/IFAS Tropical Research and Education Center (TREC), 18905 SW 280th St., Homestead, FL 33031"
                src="https://www.google.com/maps?q=UF%2FIFAS+Tropical+Research+and+Education+Center,+18905+SW+280th+St,+Homestead,+FL+33031&output=embed"
                className="h-full w-full"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>

          <div>
            <h2 className="font-display text-2xl font-bold">Contact the trial team</h2>
            <form className="mt-5 space-y-4">
              {[
                { id: 'name', label: 'Name', type: 'text', autoComplete: 'name' },
                { id: 'org', label: 'Organization', type: 'text', autoComplete: 'organization' },
              ].map((f) => (
                <div key={f.id} className="flex flex-col gap-1">
                  <label htmlFor={f.id} className="text-sm font-medium">{f.label}</label>
                  <input
                    id={f.id} name={f.id} type={f.type} autoComplete={f.autoComplete}
                    className="border border-line px-3 py-2 text-sm"
                  />
                </div>
              ))}
              <div className="flex flex-col gap-1">
                <label htmlFor="message" className="text-sm font-medium">Message</label>
                <textarea
                  id="message" name="message" rows={5}
                  className="border border-line px-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                className="bg-uf-blue px-5 py-3 font-semibold text-white"
              >
                Send message
              </button>
            </form>
          </div>
        </div>
      </Section>
    </>
  );
}
