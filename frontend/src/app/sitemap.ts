import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site-url';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

// Landverse class ids seeded in skill_classes (21..28).
const CLASS_IDS = [21, 22, 23, 24, 25, 26, 27, 28];

// Regenerate at most hourly; the sitemap is fetched by crawlers, not users.
export const revalidate = 3600;

interface CommunityPage {
  builds: { share_slug: string; created_at: string }[];
  total: number;
  pageSize: number;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();

  const entries: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/guide`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/skills`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/items`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/skill-cards`, changeFrequency: 'monthly', priority: 0.8 },
    {
      url: `${base}/skills/community`,
      changeFrequency: 'daily',
      priority: 0.8,
    },
    ...CLASS_IDS.map((id) => ({
      url: `${base}/skills/${id}`,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
  ];

  // Public community builds (capped — a sitemap does not need every page of
  // an unbounded gallery, and each fetch is one API round trip).
  try {
    const maxPages = 10; // 24 per page → up to 240 build URLs
    for (let page = 1; page <= maxPages; page++) {
      const res = await fetch(
        `${API_BASE_URL}/skills/community?page=${page}`,
        { next: { revalidate: 3600 } },
      );
      if (!res.ok) break;
      const data: CommunityPage = await res.json();
      entries.push(
        ...data.builds.map((b) => ({
          url: `${base}/skills/build/${b.share_slug}`,
          lastModified: new Date(b.created_at),
          changeFrequency: 'weekly' as const,
          priority: 0.5,
        })),
      );
      if (page * data.pageSize >= data.total) break;
    }
  } catch {
    // API unreachable (e.g. build-time) — ship the static routes only.
  }

  return entries;
}
