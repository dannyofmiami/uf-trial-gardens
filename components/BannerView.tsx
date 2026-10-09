import Link from 'next/link';
import { safeLink, type Banner } from '@/lib/banner';

export default function BannerView({ banner, headingLevel = 'h2' }: { banner: Banner; headingLevel?: 'h2' | 'p' }) {
  const link = banner.linkLabel.trim() ? safeLink(banner.linkUrl) : null;
  const Heading = headingLevel;
  return (
    <section aria-label="Announcement" className="mx-auto w-full max-w-6xl px-5 py-6">
      <div className="flex flex-col gap-4 rounded-md border-2 border-l-8 border-uf-blue border-l-uf-orange bg-surface px-5 py-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[.16em] text-muted">Announcement</p>
          <Heading className="mt-1 font-display text-2xl font-extrabold leading-tight text-uf-blue sm:text-3xl">{banner.title}</Heading>
          {banner.message.trim() && (
            <p className="mt-2 max-w-[70ch] whitespace-pre-line text-base leading-relaxed text-ink">{banner.message}</p>
          )}
        </div>
        {link && (
          link.external ? (
            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 self-start rounded bg-uf-blue px-5 py-3 font-semibold text-white hover:bg-uf-blue-dk sm:self-center"
            >
              {banner.linkLabel}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          ) : (
            <Link
              href={link.href}
              className="shrink-0 self-start rounded bg-uf-blue px-5 py-3 font-semibold text-white hover:bg-uf-blue-dk sm:self-center"
            >
              {banner.linkLabel}
            </Link>
          )
        )}
      </div>
    </section>
  );
}
