import type { Metadata } from 'next';
import type { ReactNode } from 'react';

const TITLE = 'About — dgn-grind.dev';
const DESCRIPTION =
  'What dgn-grind.dev is: a free, community-run companion site for Dragonica with a game database, skill simulator, grind tracker, item codes, and an event timetable.';

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: '/about' },
  openGraph: {
    type: 'website',
    title: TITLE,
    description: DESCRIPTION,
    url: '/about',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function AboutLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
