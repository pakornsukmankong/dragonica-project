// The canonical production origin. Search engines must see one stable host,
// so we never fall back to the *.vercel.app deploy URL for public metadata.
export const PRODUCTION_URL = 'https://dgn-grind.dev';

// Absolute site origin for metadata, robots, and the sitemap. Mirrors the
// metadataBase fallback chain in app/layout.tsx.
export function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.NODE_ENV === 'development'
      ? 'http://localhost:3000'
      : PRODUCTION_URL)
  );
}
