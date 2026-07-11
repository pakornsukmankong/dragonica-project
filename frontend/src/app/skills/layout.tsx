import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { JsonLd } from '@/components/json-ld';
import { siteUrl } from '@/lib/site-url';

const TITLE = 'Dragonica Skill Build Simulator — Plan & Share Builds';
const DESCRIPTION =
  'Free Dragonica skill build simulator. Plan skill trees for every class, calculate skill points, and share your build with a link.';

// Applies to /skills and its sub-routes; /skills/build/[slug] overrides with
// its own per-build metadata.
export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: '/skills' },
  openGraph: {
    type: 'website',
    title: TITLE,
    description: DESCRIPTION,
    url: '/skills',
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
};

export default function SkillsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'WebApplication',
          name: 'Dragonica Skill Build Simulator',
          description: DESCRIPTION,
          url: `${siteUrl()}/skills`,
          applicationCategory: 'GameApplication',
          operatingSystem: 'Web',
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
          about: { '@type': 'VideoGame', name: 'Dragonica' },
        }}
      />
      {children}
    </>
  );
}
