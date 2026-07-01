'use client';

import { useLocale } from 'next-intl';

/**
 * Returns a date formatter bound to the active UI locale, so dates render in
 * Thai (Buddhist era) when the app is in Thai and US-English otherwise.
 */
export function useDateFormatter() {
  const locale = useLocale();
  const intlLocale = locale === 'th' ? 'th-TH' : 'en-US';
  return (value: string | number | Date, options?: Intl.DateTimeFormatOptions) =>
    new Date(value).toLocaleDateString(intlLocale, options);
}
