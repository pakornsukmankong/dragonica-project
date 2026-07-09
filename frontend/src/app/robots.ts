import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site-url';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Authenticated app areas — nothing indexable behind these.
      disallow: [
        '/admin',
        '/dashboard',
        '/characters',
        '/sessions',
        '/grind',
        '/settings',
        '/support',
        '/tickets',
        '/login',
        '/auth/',
      ],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
