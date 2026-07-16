import type { Metadata } from 'next';
import { Varela_Round, Noto_Sans_Thai } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';
import { Providers } from '@/components/providers';
import { AppShell } from '@/components/app-shell';
import { Clarity } from '@/components/clarity';
import { GoogleAnalytics } from '@/components/google-analytics';
import { JsonLd } from '@/components/json-ld';
import { siteUrl } from '@/lib/site-url';

// Latin text. Varela Round ships a single weight (400); bolder text is
// synthesized by the browser.
const varelaRound = Varela_Round({
  subsets: ['latin'],
  weight: '400',
  variable: '--default-font-family',
  display: 'swap',
});

// Thai glyphs (Varela Round has none) fall through to this in the font stack.
const notoSansThai = Noto_Sans_Thai({
  subsets: ['thai'],
  variable: '--font-noto-thai',
  display: 'swap',
});

const SITE_NAME = 'Dragonica Grind Tracker';
const HOME_TITLE =
  'Dragonica Grind Tracker — Skill Simulator & Item Database';
const DESCRIPTION =
  'Free Dragonica tools: a skill build simulator, a 29,000+ item database with stats and drop locations, a monster database, and a grind session tracker.';

export const metadata: Metadata = {
  // Absolute base so Open Graph/Twitter/canonical URLs resolve to the one
  // canonical production host (never the *.vercel.app deploy URL).
  metadataBase: new URL(siteUrl()),
  title: {
    default: HOME_TITLE,
    // Inner pages set a short title; this frames it with the brand.
    template: '%s | Dragonica Grind Tracker',
  },
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    'Dragonica',
    'Dragon Saga',
    'Dragonica skill simulator',
    'Dragonica skill build',
    'Dragonica skill build simulator',
    'Dragonica item database',
    'Dragonica items',
    'Dragonica monster',
    'Dragonica drops',
    'Dragonica grind tracker',
  ],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    title: HOME_TITLE,
    description: DESCRIPTION,
    url: '/',
  },
  twitter: {
    card: 'summary_large_image',
    title: HOME_TITLE,
    description: DESCRIPTION,
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();
  const origin = siteUrl();

  return (
    <html
      lang={locale}
      className={`${varelaRound.variable} ${notoSansThai.variable}`}
    >
      <body>
        <JsonLd
          data={{
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: SITE_NAME,
            alternateName: 'Dragonica Tools',
            url: origin,
            description: DESCRIPTION,
            inLanguage: ['en', 'th'],
            about: {
              '@type': 'VideoGame',
              name: 'Dragonica',
              alternateName: 'Dragon Saga',
            },
          }}
        />
        <Clarity />
        <GoogleAnalytics />
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>
            <AppShell>{children}</AppShell>
          </Providers>
        </NextIntlClientProvider>
        {/* Vercel Analytics — page views + visitors. Injects its own script
            and is a no-op outside Vercel deploys, so local dev stays clean. */}
        <Analytics />
      </body>
    </html>
  );
}
