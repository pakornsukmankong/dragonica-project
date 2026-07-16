import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { JsonLd } from '@/components/json-ld';

const TITLE = 'Dragonica Skill Cards — Monster Drops & Wanted Quest Levels';
const DESCRIPTION =
  'Every Dragonica skill card by class: the skill it unlocks, the monster that drops it, and the level you claim it from the Wanted quest.';

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: '/skill-cards' },
  openGraph: {
    type: 'website',
    title: TITLE,
    description: DESCRIPTION,
    url: '/skill-cards',
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
};

export default function SkillCardsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Dataset',
          name: 'Dragonica Skill Card Database',
          description: DESCRIPTION,
          keywords: [
            'Dragonica skill card',
            'Dragonica skill cards',
            'Dragonica wanted quest',
            'Dragonica class skill',
          ],
          about: { '@type': 'VideoGame', name: 'Dragonica' },
        }}
      />
      {children}
    </>
  );
}
