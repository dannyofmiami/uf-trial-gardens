'use client';

import { useEffect, useRef } from 'react';

export default function PhotoLightbox({
  src, alt, caption, open, onClose,
}: { src: string; alt: string; caption?: string; open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = 'hidden';
    return () => { html.style.overflow = prev; };
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={alt}
      onClose={onClose}
      onClick={(e) => {
        if (!(e.target instanceof HTMLImageElement)) onClose();
      }}
      className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none bg-black p-0 text-white backdrop:bg-black"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close photo"
        className="fixed right-[max(0.75rem,env(safe-area-inset-right))] top-[max(0.75rem,env(safe-area-inset-top))] z-10 grid h-11 w-11 place-items-center rounded-full bg-black/60 text-white transition hover:bg-black/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>

      {/* short screens (phone held sideways) can't spare 4rem top and bottom */}
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-4 py-16 [@media(max-height:500px)]:gap-1 [@media(max-height:500px)]:py-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className="max-h-full max-w-full min-h-0 object-contain"
        />
        {caption && (
          <p className="font-mono text-[11px] uppercase tracking-[.12em] text-white/80">{caption}</p>
        )}
      </div>
    </dialog>
  );
}
