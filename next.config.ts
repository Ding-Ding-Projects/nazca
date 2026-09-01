import type { NextConfig } from 'next';

const pagesBasePath = process.env.PAGES_BASE_PATH ?? '';
const staticExport = process.env.STATIC_EXPORT === '1';

const nextConfig: NextConfig = {
  ...(pagesBasePath ? { assetPrefix: pagesBasePath } : {}),
  ...(staticExport ? { output: 'export' as const } : {}),
  trailingSlash: false,
};

export default nextConfig;
