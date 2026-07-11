import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { JsonLd } from '@/components/json-ld';

const TITLE = 'Dragonica Item Database — 29,000+ Items, Stats & Drops';
const DESCRIPTION =
  'Browse every Dragonica item — weapons, armor, costumes, consumables and more — with full stats, rarity, set effects, and where each item drops.';

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: '/items' },
  openGraph: {
    type: 'website',
    title: TITLE,
    description: DESCRIPTION,
    url: '/items',
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
};

export default function ItemsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Dataset',
          name: 'Dragonica Item Database',
          description: DESCRIPTION,
          keywords: [
            'Dragonica item',
            'Dragonica items',
            'Dragonica item database',
            'Dragonica weapons',
            'Dragonica armor',
          ],
          about: { '@type': 'VideoGame', name: 'Dragonica' },
        }}
      />
      {children}
    </>
  );
}
