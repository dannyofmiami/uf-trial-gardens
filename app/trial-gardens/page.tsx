import type { Metadata } from 'next';
import { cultivars, facets, meta } from '@/lib/data';
import { PageHeader, Section } from '@/components/Ui';
import DatabaseBrowser from '@/components/DatabaseBrowser';

export const metadata: Metadata = {
  title: 'Trial Gardens Database',
  description:
    'Searchable, side-by-side performance data for ornamental cultivars trialed in-ground at the UF Public Trial Gardens, Homestead, FL.',
};

export default function TrialGardens() {
  return (
    <>
      <PageHeader
        eyebrow={`University of Florida · ${meta.site}`}
        title="Trial Gardens Database"
        lede={`Searchable, side-by-side performance data for ${meta.cultivarCount} ornamental cultivars trialed in the ground in Homestead, Florida (USDA Hardiness Zone ${meta.hardinessZone}). Filter and sort below, then open any cultivar for its full rating history.`}
      />
      <Section>
        <div className="mt-8">
          <DatabaseBrowser
            cultivars={cultivars}
            genera={facets.genera}
            suppliers={facets.suppliers}
          />
        </div>
      </Section>
    </>
  );
}
