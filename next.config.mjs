import { resolve } from 'node:path';

/** @type {import('next').NextConfig} */
// set NEXT_PUBLIC_BASE_PATH=/repo-name when building for GitHub Pages
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

// '@trial-data' is the one dataset the site reads: sample data under dev:mock/build:mock,
// real data otherwise. Each build only ever contains the one it uses.
const trialData = resolve(
  process.env.NEXT_PUBLIC_MOCK_DATA === '1' ? './data/trials.mock.json' : './data/trials.json',
);

// '@admin-demo' is the temporary browser-only admin (lib/admin-demo.ts) under build:demo,
// and a do-nothing stand-in otherwise, so no other build contains the demo password.
const adminDemo = resolve(
  process.env.NEXT_PUBLIC_ADMIN_DEMO === '1' ? './lib/admin-demo.ts' : './lib/admin-demo.off.ts',
);

const nextConfig = {
  basePath,
  // static export, builds to /out
  output: 'export',
  images: { unoptimized: true },
  trailingSlash: true,
  webpack: (config) => {
    config.resolve.alias['@trial-data'] = trialData;
    config.resolve.alias['@admin-demo'] = adminDemo;
    // the build cache must not reuse one variant's modules for another
    if (config.cache && typeof config.cache === 'object') {
      config.cache.version = `${config.cache.version ?? ''}|${trialData}|${adminDemo}`;
    }
    return config;
  },
};

export default nextConfig;
