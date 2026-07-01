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
 * re-renders with the new messages. `compact` is used in the sidebar/nav.
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
      className={`inline-flex items-center gap-1 rounded-base bg-raised p-1 ${
        compact ? '' : 'w-fit'
      }`}
    >
      {locales.map((locale) => (
        <button
          key={locale}
          type="button"
          onClick={() => change(locale)}
          className={`rounded-sm font-medium transition-colors duration-150 ${
            compact ? 'px-2 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'
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
