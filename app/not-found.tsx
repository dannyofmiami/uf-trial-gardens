import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-24 text-center">
      <p className="font-mono text-[11px] font-semibold uppercase tracking-[.16em] text-uf-blue">404</p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight">Page not found</h1>
      <p className="mt-4 text-muted">
        That page isn&rsquo;t part of the trial gardens site.
      </p>
      <Link
        href="/trial-gardens/"
        className="mt-8 inline-block bg-uf-blue px-5 py-3 font-semibold text-white"
      >
        Browse the trial database
      </Link>
    </div>
  );
}
