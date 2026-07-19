import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { JsonLd } from '@/components/json-ld';

const TITLE = 'Dragonica Game Database — Items, Monsters, Stats & Drops';
const DESCRIPTION =
  'Browse every Dragonica item and monster — weapons, armor, costumes and consumables with full stats, rarity and set effects, plus monster levels, HP, spawn maps and what they drop.';

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
          name: 'Dragonica Game Database',
          description: DESCRIPTION,
          keywords: [
            'Dragonica item',
            'Dragonica items',
            'Dragonica item database',
            'Dragonica weapons',
            'Dragonica armor',
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
