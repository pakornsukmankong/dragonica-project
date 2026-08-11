import type { Metadata } from 'next';
import type { ReactNode } from 'react';

const TITLE = 'Contact — dgn-grind.dev';
const DESCRIPTION =
  'How to reach dgn-grind.dev: join the community Discord, follow the YouTube channel, or open an in-app support ticket for account and payment help.';

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: '/contact' },
  openGraph: {
    type: 'website',
    title: TITLE,
    description: DESCRIPTION,
    url: '/contact',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function ContactLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
