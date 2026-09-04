import type { NextConfig } from 'next';

const pagesBasePath = process.env.PAGES_BASE_PATH ?? '';
const staticExport = process.env.STATIC_EXPORT === '1';

const nextConfig: NextConfig = {
  ...(pagesBasePath ? { assetPrefix: pagesBasePath } : {}),
  ...(staticExport ? { output: 'export' as const } : {}),
  // GitHub Pages serves static directories predictably, while the primary
  // Sites and offline outputs retain their root-path file layout.
  trailingSlash: Boolean(pagesBasePath),
};

export default nextConfig;
