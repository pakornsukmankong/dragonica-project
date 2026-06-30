import type { Metadata } from 'next';
import { Montserrat } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';
import { AppShell } from '@/components/app-shell';

const montserrat = Montserrat({
  subsets: ['latin'],
  variable: '--default-font-family',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Dragonica Grind Tracker',
  description: 'Track your grinding sessions, gold, and progress in Dragonica',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={montserrat.variable}>
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
