import type { Metadata } from 'next';
import type { ReactNode } from 'react';

const TITLE = 'Privacy Policy — dgn-grind.dev';
const DESCRIPTION =
  'How dgn-grind.dev handles your data: what an account stores, the analytics and advertising cookies used, and how to opt out.';

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: '/privacy' },
  openGraph: {
    type: 'website',
    title: TITLE,
    description: DESCRIPTION,
    url: '/privacy',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function PrivacyLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
