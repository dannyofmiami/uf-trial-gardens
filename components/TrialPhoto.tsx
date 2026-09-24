'use client';

import { useState } from 'react';
import {
  withBase, latestMirroredImage, fmtDate, type Cultivar, type TrialImage,
} from '@/lib/data';

type Variant = 'card' | 'detail' | 'round';

// The Dropbox links in the spreadsheet are private, so visitors just get a
// sign-in page. Only use the copies in /plants, otherwise show the placeholder.
function getUrls(img: TrialImage | undefined, variant: Variant): string[] {
  if (!img || !img.mirrored) return [];

  // cards and round thumbnails use the small version so the page isn't loading
  // dozens of full-size photos at once
  const small = variant === 'detail' ? img.local : (img.thumb ?? img.local);
  if (small === img.local) return [small];
  return [small, img.local];
}

export default function TrialPhoto(props: {
  c: Cultivar; className?: string; variant?: Variant; image?: TrialImage;
}) {
  const { c, className = '', variant = 'detail', image } = props;
  // an explicit `image` (even an undefined one, e.g. a round with no photo on
  // file) wins over the default -- only fall back to the most recently taken
  // mirrored photo when the caller didn't pass the prop at all, so selecting a
  // photo-less round shows "no photo" instead of silently reusing another
  // round's picture
  const img = 'image' in props ? image : latestMirroredImage(c);
  const urls = getUrls(img, variant);
  const [attempt, setAttempt] = useState(0);

  const exhausted = attempt >= urls.length;

  if (exhausted) {
    return (
      <div
        className={`grid place-items-center border border-dashed border-line bg-ground text-center ${className}`}
        role="img"
        aria-label={
          urls.length === 0
            ? `No trial photo on file for ${c.name}${image ? ` on ${fmtDate(image.date)}` : ''}`
            : `Trial photo for ${c.name} could not be loaded`
        }
      >
        <div className="flex flex-col items-center gap-2 px-3">
          <span className={variant === 'round' ? 'text-xl' : 'text-4xl'}>🌱</span>
          {variant !== 'round' && (
            <span className="font-mono text-[10px] uppercase tracking-[.12em] text-muted">
              {urls.length === 0 ? 'photo unavail' : 'Photo playing hide-and-seek'}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={withBase(urls[attempt])}
      alt={`${c.name} (${c.genus}) growing in the trial beds at Homestead${img ? `, photographed ${fmtDate(img.date)}` : ''}`}
      loading="lazy"
      decoding="async"
      onError={() => setAttempt((n) => n + 1)}
      className={`bg-ground object-cover ${className}`}
    />
  );
}
