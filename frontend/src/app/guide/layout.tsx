import type { Metadata } from 'next';
import type { ReactNode } from 'react';

const TITLE = 'Dragonica Guide — Grinding, Gold & Skill Builds';
const DESCRIPTION =
  'How to get the most out of the Dragonica grind tracker, skill build simulator, and item database.';

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: '/guide' },
  openGraph: {
    type: 'article',
    title: TITLE,
    description: DESCRIPTION,
    url: '/guide',
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
};

export default function GuideLayout({ children }: { children: ReactNode }) {
  return children;
}
