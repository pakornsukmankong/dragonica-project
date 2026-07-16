'use client';

import { AlertTriangle, RotateCcw, WifiOff } from 'lucide-react';
import { useTranslations } from 'next-intl';

/**
 * Failure state for a data query. Without it a failed read falls through to the
 * page's empty state, which tells the user their data is empty when it merely
 * failed to load.
 *
 * Pass `offline` for a paused query: with the default networkMode React Query
 * parks a request it cannot send instead of failing it, so `isError` stays
 * false and only `isPaused` reveals the lost connection.
 */
export function QueryError({
  onRetry,
  isRetrying,
  offline = false,
  compact = false,
  className = '',
}: {
  onRetry: () => void;
  isRetrying?: boolean;
  offline?: boolean;
  /** Inline one-liner, for panels too small to host the full card. */
  compact?: boolean;
  className?: string;
}) {
  const t = useTranslations('common');
  const Icon = offline ? WifiOff : AlertTriangle;
  const title = offline ? t('offlineTitle') : t('loadErrorTitle');
  const desc = offline ? t('offlineDesc') : t('loadErrorDesc');

  if (compact) {
    return (
      <div role="alert" className={`flex items-center gap-2 ${className}`}>
        <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--fg-danger)]" />
        <p className="text-xs text-muted">{title}</p>
        <button
          onClick={onRetry}
          disabled={isRetrying}
          className="text-xs font-medium text-gold underline-offset-2 hover:underline disabled:opacity-60"
        >
          {isRetrying ? t('retrying') : t('retry')}
        </button>
      </div>
    );
  }

  return (
    <div
      role="alert"
      className={`bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-10 text-center ${className}`}
    >
      <span className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-base bg-[var(--danger-soft)] text-[var(--fg-danger)]">
        <Icon className="h-5 w-5" />
      </span>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mx-auto mt-1.5 max-w-xs text-xs leading-relaxed text-muted">
        {desc}
      </p>
      <button
        onClick={onRetry}
        disabled={isRetrying}
        className="mt-5 inline-flex items-center gap-2 rounded-base border border-border px-4 py-2 text-xs font-medium text-foreground transition-colors duration-150 hover:border-gold/50 hover:text-gold disabled:opacity-60"
      >
        <RotateCcw
          className={`h-3.5 w-3.5 ${isRetrying ? 'animate-spin' : ''}`}
        />
        {isRetrying ? t('retrying') : t('retry')}
      </button>
    </div>
  );
}
