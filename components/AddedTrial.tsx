'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { TrialData } from '@/lib/data';
import { addedCultivar, loadCultivarEdits, type EditsFile } from '@/lib/cultivar-edits';
import CultivarDetail from '@/components/CultivarDetail';
import { Section } from '@/components/Ui';

// A trial added in /admin, read from the saved edits by the ?id= in the address.
export default function AddedTrial({ meta }: { meta: TrialData['meta'] }) {
  const id = useSearchParams().get('id') ?? '';
  const [edits, setEdits] = useState<EditsFile | null>(null);
  useEffect(() => { loadCultivarEdits().then(setEdits); }, []);

  const edit = edits?.cultivars[id];
  useEffect(() => {
    if (edit?.added && edit.fields.name) document.title = document.title.replace('Trial details', `${edit.fields.name} (${edit.fields.genus})`);
  }, [edit]);

  if (!edits) return <Section><p className="text-muted">Loading…</p></Section>;
  if (!edit?.added) {
    return (
      <Section>
        <h1 className="font-display text-3xl font-bold">Trial not found</h1>
        <p className="mt-3 text-muted">
          This trial may have been removed.{' '}
          <Link href="/trial-gardens/" className="font-semibold text-uf-blue underline underline-offset-4">
            Back to the trial gardens database
          </Link>
        </p>
      </Section>
    );
  }
  return <CultivarDetail key={id} c={addedCultivar(id, edit)} evals={[]} meta={meta} />;
}
