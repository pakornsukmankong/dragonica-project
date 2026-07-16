'use client';

import { useEffect } from 'react';
import { recordVisit } from '@/lib/stats';

/**
 * Counts one site visit per browser session. Mounted in the root layout so a
 * reader who lands on /items from search counts the same as one who opens the
 * landing page — the counter used to live on the landing page alone and missed
 * every direct hit on the SEO pages.
 *
 * Renders nothing; VisitorCounter shows the total.
 */
export function SiteVisit() {
  useEffect(() => {
    // Per session, not per load, so refreshing does not inflate the count. The
    // key is set before the POST so React strict mode's double effect in dev
    // does not count twice — same shape as a build's view count.
    const key = 'site_visited';
    if (!sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, '1');
      // Vanity counter — a failure must never surface to the reader.
      recordVisit().catch(() => {});
    }
  }, []);

  return null;
}
