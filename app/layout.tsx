import type { Metadata } from 'next';
import Link from 'next/link';
import { meta } from '@/lib/data';
import './globals.css';

// UF/IFAS branding rules.
// anything marked [ifas] is required

const UNIT = 'Public Trial Gardens';
const CENTER = 'Tropical Research and Education Center';
const WEB_CONTACT = 'webteam@ifas.ufl.edu';

export const metadata: Metadata = {
  title: {
    default: `${UNIT} - UF/IFAS TREC, Homestead, FL`,
    template: `%s | ${UNIT} - UF/IFAS TREC`,
  },
  description:
    'Independent, side-by-side ornamental performance data for South Florida heat, humidity and rainfall. Homestead, FL, USDA Hardiness Zone 11b.',
  icons: { icon: 'https://trec.ifas.ufl.edu/favicon.ico' }, // [ifas]
  other: {
    // [ifas] required meta tags
    author: 'IFAS Communications',
    coverage: 'Florida, USA',
    language: 'en',
    subject: 'Institute of Food and Agricultural Sciences, The University of Florida',
  },
};

const NAV = [
  { href: '/about/', label: 'About the Program' },
  { href: '/trial-gardens/', label: 'Gardens Database' },
  { href: '/partners/', label: 'Industry Partners' },
  { href: '/visit/', label: 'Visit & Contact' },
];

const POLICY = [
  ['Accessible UF', 'https://accessibility.ufl.edu/'],
  ['EEO Statement', 'https://ics.ifas.ufl.edu/uf-ifas-legal-statements/'],
  ['IFAS Web Policy', 'https://ics.ifas.ufl.edu/our-services/web-services/'],
  ['UF Privacy', 'https://privacy.ufl.edu/policies/onlineinternet-privacy-policy-/'],
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const revised = new Date(meta.generatedAt).toLocaleDateString('en-US', {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
  });

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Anybody:wght@600;700;800&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&display=swap"
        />
      </head>
      <body className="min-h-screen flex flex-col">
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-white focus:px-4 focus:py-2 focus:font-semibold focus:text-uf-blue"
        >
          Skip to main content
        </a>

        {/* [ifas] blue background, white text */}
        <header className="bg-uf-blue text-white">
          <div className="mx-auto w-full max-w-6xl px-5 py-4">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
              {/* [ifas] logo top left, links to ifas.ufl.edu. p-2 is the required clear space */}
              <a href="https://ifas.ufl.edu" className="block p-2 -m-2 shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://trec.ifas.ufl.edu/media/ifasufledu/white/style-assets/css/images/IFASwhitelogo.svg"
                  alt="UF Institute of Food and Agricultural Sciences"
                  width={190}
                  height={44}
                  className="h-11 w-auto"
                />
              </a>

              {/* [ifas] unit name under the logo */}
              <Link href="/" className="min-w-0">
                <span className="block font-display text-xl font-bold leading-tight">{UNIT}</span>
                <span className="block font-mono text-[11px] uppercase tracking-[.12em] text-white/75">
                  {CENTER} · Homestead, FL
                </span>
              </Link>

              <a
                href="https://ufl.edu"
                className="ml-auto hidden font-mono text-[11px] uppercase tracking-[.12em] text-white/75 hover:text-white sm:block"
              >
                University of Florida
              </a>
            </div>
          </div>

          <nav aria-label="Primary" className="border-t border-white/20">
            <div className="mx-auto flex w-full max-w-6xl flex-wrap gap-x-1 px-3">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="border-b-[3px] border-transparent px-3 py-3 text-sm font-medium hover:border-uf-orange hover:bg-white/10"
                >
                  {n.label}
                </Link>
              ))}
            </div>
          </nav>
        </header>

        <main id="content" className="flex-1">{children}</main>

        {/* [ifas] footer, same colors as the header */}
        <footer className="mt-20 bg-uf-blue text-white">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-12 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2 lg:col-span-1">
              {/* [ifas] link to ufl.edu */}
              <a href="https://ufl.edu" className="inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://trec.ifas.ufl.edu/media/ifasufledu/white/style-assets/ifas-f6v3/images/UF_Signature_SVG-f6v3.svg"
                  alt="University of Florida"
                  width={200}
                  height={56}
                  className="h-14 w-auto"
                />
              </a>
              <p className="mt-4 text-sm leading-relaxed text-white/85">
                Independent ornamental trials for South Florida, Homestead, FL,
                USDA Hardiness Zone {meta.hardinessZone}.
              </p>
            </div>

            <div>
              <h2 className="font-display text-sm font-bold uppercase tracking-wide">Explore</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {NAV.map((n) => (
                  <li key={n.href}>
                    <Link href={n.href} className="text-white/85 underline-offset-4 hover:text-white hover:underline">
                      {n.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h2 className="font-display text-sm font-bold uppercase tracking-wide">Contact</h2>
              <address className="mt-3 space-y-1 text-sm not-italic leading-relaxed text-white/85">
                {/* [ifas] link to the unit site */}
                <a href="https://trec.ifas.ufl.edu" className="block underline-offset-4 hover:text-white hover:underline">
                  {CENTER}
                </a>
                <span className="block">18905 S.W. 280 Street</span>
                <span className="block">Homestead, FL 33031</span>
                <a href="tel:+13052467000" className="block underline-offset-4 hover:text-white hover:underline">
                  (305) 246-7000
                </a>
              </address>
              {/* [ifas] someone to contact about the site */}
              <p className="mt-3 text-sm">
                <a href={`mailto:${WEB_CONTACT}`} className="font-semibold underline underline-offset-4">
                  Website feedback
                </a>
              </p>
            </div>

            <div>
              <h2 className="font-display text-sm font-bold uppercase tracking-wide">Policy</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {POLICY.map(([label, href]) => (
                  <li key={label}>
                    <a href={href} className="text-white/85 underline-offset-4 hover:text-white hover:underline">
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="border-t border-white/20">
            <div className="mx-auto flex w-full max-w-6xl flex-wrap justify-between gap-3 px-5 py-5 text-xs text-white/75">
              <p>
                © {new Date().getFullYear()}{' '}
                <a href="https://ufl.edu" className="underline underline-offset-4">University of Florida</a>,{' '}
                <a href="https://ifas.ufl.edu" className="underline underline-offset-4">IFAS</a>
              </p>
              {/* [ifas] last revision date */}
              <p>Last modified: {revised}</p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
