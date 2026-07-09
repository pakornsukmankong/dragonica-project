'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, RotateCcw } from 'lucide-react';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('errorPages');

  useEffect(() => {
    // Surface the error for debugging; nothing sensitive is rendered to users.
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-[70vh] items-center justify-center bg-root px-4">
      <div className="max-w-sm text-center">
        <span className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-base bg-[var(--danger-soft)] text-[var(--fg-danger)]">
          <AlertTriangle className="h-7 w-7" />
        </span>
        <h1 className="text-xl font-medium text-foreground">
          {t('errorTitle')}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {t('errorDesc')}
        </p>
        {error.digest && (
          <p className="mt-2 text-[11px] text-dark-gray">ref: {error.digest}</p>
        )}
        <button
          onClick={reset}
          className="mt-6 inline-flex items-center gap-2 rounded-base bg-gold px-5 py-2.5 text-sm font-semibold text-[#1b1407] shadow-button transition-opacity hover:opacity-90"
        >
          <RotateCcw className="h-4 w-4" />
          {t('tryAgain')}
        </button>
      </div>
    </main>
  );
}
