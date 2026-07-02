import type { Metadata } from 'next';
import { Varela_Round, Noto_Sans_Thai } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import './globals.css';
import { Providers } from '@/components/providers';
import { AppShell } from '@/components/app-shell';

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

export const metadata: Metadata = {
  title: 'Dragonica Grind Tracker',
  description: 'Track your grinding sessions, gold, and progress in Dragonica',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      className={`${varelaRound.variable} ${notoSansThai.variable}`}
    >
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>
            <AppShell>{children}</AppShell>
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
