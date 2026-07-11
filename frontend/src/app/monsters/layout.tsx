import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { JsonLd } from '@/components/json-ld';

const TITLE = 'Dragonica Monster Database — Stats, Drops & Spawn Maps';
const DESCRIPTION =
  'Every Dragonica monster with level, grade, HP and combat stats, the maps they spawn in, and the items they drop.';

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: '/monsters' },
  openGraph: {
    type: 'website',
    title: TITLE,
    description: DESCRIPTION,
    url: '/monsters',
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
};

export default function MonstersLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Dataset',
          name: 'Dragonica Monster Database',
          description: DESCRIPTION,
          keywords: [
            'Dragonica monster',
            'Dragonica monsters',
            'Dragonica monster drops',
            'Dragonica boss',
          ],
          about: { '@type': 'VideoGame', name: 'Dragonica' },
        }}
      />
      {children}
    </>
  );
}
