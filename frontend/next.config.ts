import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Emit a minimal self-contained server for Docker deploys (ignored by Vercel).
  output: 'standalone',
  // Hide the on-screen Next.js dev tools indicator (the floating logo button).
  devIndicators: false,
};

export default withNextIntl(nextConfig);
