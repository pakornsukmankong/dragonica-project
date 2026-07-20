import type { Metadata } from 'next';
import type { ReactNode } from 'react';

const TITLE = 'Dragonica Item Codes — Community Coupon List';
const DESCRIPTION =
  'A community-maintained list of Dragonica item codes with active/expired status — copy a code to redeem in game, or add one you found to share with everyone.';

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: '/codes' },
  openGraph: {
    type: 'website',
    title: TITLE,
    description: DESCRIPTION,
    url: '/codes',
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
};

export default function CodesLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
