'use client';

import { useEffect, useState } from 'react';
import { Eye } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { recordVisit, getVisits } from '@/lib/stats';

// Guard against React StrictMode's double-invoke in dev so a single page load
// counts as one view. Reset on a real navigation/refresh (module reloads).
let counted = false;

/**
 * Records this page view once per load and shows the running total. Best-effort:
 * renders nothing until the count arrives and stays silent if the API fails.
 */
export function VisitorCounter() {
  const t = useTranslations('landing');
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    const shouldRecord = !counted;
    counted = true;
    (async () => {
      try {
        const { total } = shouldRecord
          ? await recordVisit()
          : await getVisits();
        // A malformed payload must not crash the landing page: an undefined
        // total would slip past the null check and throw in render.
        if (typeof total === 'number') setTotal(total);
      } catch {
        // Vanity counter — never block the page on it.
      }
    })();
  }, []);

  if (total === null) return null;

  return (
    <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-muted">
      <Eye className="h-3.5 w-3.5" />
      {t('visitorCount', { count: total.toLocaleString() })}
    </p>
  );
}
