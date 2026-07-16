'use client';

import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { locales, type Locale } from '@/i18n/config';

const LABEL: Record<Locale, string> = { en: 'EN', th: 'TH' };

function setLocaleCookie(locale: Locale) {
  document.cookie = `NEXT_LOCALE=${locale}; path=/; max-age=31536000; samesite=lax`;
}

/**
 * Segmented EN/TH control. Writes the locale cookie and refreshes so the server
 * re-renders with the new messages. `compact` stretches to fill its container
 * with evenly split halves — used in the sidebar/nav so it lines up with the
 * full-width button stacked under it; it stays visually secondary via the
 * recessed background and smaller type, not by being narrower.
 */
export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const active = useLocale() as Locale;
  const router = useRouter();

  const change = (locale: Locale) => {
    if (locale === active) return;
    setLocaleCookie(locale);
    router.refresh();
  };

  return (
    <div
      className={`items-center gap-1 rounded-base bg-raised p-1 ${
        compact ? 'flex w-full' : 'inline-flex w-fit'
      }`}
    >
      {locales.map((locale) => (
        <button
          key={locale}
          type="button"
          onClick={() => change(locale)}
          className={`rounded-sm font-medium transition-colors duration-150 ${
            compact ? 'flex-1 px-2 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'
          } ${
            active === locale
              ? 'bg-surface text-foreground outline outline-1 outline-[rgba(255,255,255,0.08)]'
              : 'text-muted hover:text-foreground'
          }`}
        >
          {LABEL[locale]}
        </button>
      ))}
    </div>
  );
}
