import type { Metadata } from 'next';
import { Suspense } from 'react';
import { meta } from '@/lib/data';
import AddedTrial from '@/components/AddedTrial';

// One page for every trial added in /admin (/trial-gardens/view/?id=...): the site is built
// ahead of time, so a trial added later can't have its own page until the next build.
export const metadata: Metadata = { title: 'Trial details' };

export default function AddedTrialPage() {
  return (
    <Suspense fallback={null}>
      <AddedTrial meta={meta} />
    </Suspense>
  );
}
