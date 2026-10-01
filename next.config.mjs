import { resolve } from 'node:path';

/** @type {import('next').NextConfig} */
// set NEXT_PUBLIC_BASE_PATH=/repo-name when building for GitHub Pages
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

// '@trial-data' is the one dataset the site reads: sample data under dev:mock/build:mock,
// real data otherwise. Each build only ever contains the one it uses.
const trialData = resolve(
  process.env.NEXT_PUBLIC_MOCK_DATA === '1' ? './data/trials.mock.json' : './data/trials.json',
);

const nextConfig = {
  basePath,
  // static export, builds to /out
  output: 'export',
  images: { unoptimized: true },
  trailingSlash: true,
  webpack: (config) => {
    config.resolve.alias['@trial-data'] = trialData;
    return config;
  },
};

export default nextConfig;
