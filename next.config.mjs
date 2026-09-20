/** @type {import('next').NextConfig} */
// set NEXT_PUBLIC_BASE_PATH=/repo-name when building for GitHub Pages
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

const nextConfig = {
  basePath,
  // static export, builds to /out
  output: 'export',
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
