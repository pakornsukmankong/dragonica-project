import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Emit a minimal self-contained server for Docker deploys (ignored by Vercel).
  output: 'standalone',
  // Hide the on-screen Next.js dev tools indicator (the floating logo button).
  devIndicators: false,
  // Long-cache the immutable static game data so repeat visits and tab/page
  // switches serve from cache instead of revalidating every file.
  async headers() {
    return [
      {
        // Icon atlas sheets never change once generated.
        source: '/item-atlas/:file*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        // Item/monster JSON updates only on a manual regen + deploy — cache
        // short with SWR so a redeploy propagates within a day.
        source: '/data/items/:file*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600, stale-while-revalidate=86400',
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
