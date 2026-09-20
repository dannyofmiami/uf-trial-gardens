'use client';

import { useState } from 'react';
import { withBase, type Cultivar } from '@/lib/data';

type Variant = 'card' | 'detail';

// The Dropbox links in the spreadsheet are private, so visitors just get a
// sign-in page. Only use the copies in /plants, otherwise show the placeholder.
function getUrls(c: Cultivar, variant: Variant): string[] {
  const img = c.images[0];
  if (!img || !img.mirrored) return [];

  // cards use the small version so the grid isn't loading 89 full size photos
  const first = variant === 'card' ? (img.thumb ?? img.local) : img.local;
  if (first === img.local) return [first];
  return [first, img.local];
}

export default function TrialPhoto({
  c, className = '', variant = 'detail',
}: { c: Cultivar; className?: string; variant?: Variant }) {
  const urls = getUrls(c, variant);
  const [attempt, setAttempt] = useState(0);

  const exhausted = attempt >= urls.length;

  if (exhausted) {
    return (
      <div
        className={`grid place-items-center border border-dashed border-line bg-ground text-center ${className}`}
        role="img"
        aria-label={
          urls.length === 0
            ? `No trial photo on file for ${c.name}`
            : `Trial photo for ${c.name} could not be loaded`
        }
      >
        <div className="flex flex-col items-center gap-2 px-3">
          <span className="text-4xl">🌱</span>
          <span className="font-mono text-[10px] uppercase tracking-[.12em] text-muted">
            {urls.length === 0 ? 'photo unavail' : 'Photo playing hide-and-seek'}
          </span>
        </div>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={withBase(urls[attempt])}
      alt={`${c.name} (${c.genus}) growing in the trial beds at Homestead`}
      loading="lazy"
      decoding="async"
      onError={() => setAttempt((n) => n + 1)}
      className={`bg-ground object-cover ${className}`}
    />
  );
}
