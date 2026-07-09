'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Compass, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  const t = useTranslations('errorPages');

  return (
    <main className="flex min-h-[70vh] items-center justify-center bg-root px-4">
      <div className="max-w-sm text-center">
        <span className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-base bg-gold-soft text-gold shadow-gold">
          <Compass className="h-7 w-7" />
        </span>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-dim">
          404
        </p>
        <h1 className="mt-2 text-xl font-medium text-foreground">
          {t('notFoundTitle')}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {t('notFoundDesc')}
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center gap-2 rounded-base bg-gold px-5 py-2.5 text-sm font-semibold text-[#1b1407] shadow-button transition-opacity hover:opacity-90"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('backHome')}
        </Link>
      </div>
    </main>
  );
}
