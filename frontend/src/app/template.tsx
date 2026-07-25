'use client';

import { m } from 'motion/react';
import { usePathname } from 'next/navigation';
import { isOverlayRoute } from '@/components/off-overlay';

/**
 * A template re-mounts on every navigation (unlike layout), so this plays a
 * gentle fade + rise on each page. It sits *inside* the persistent AppShell,
 * so only the page content animates — the sidebar stays put. Server-component
 * pages passed as `children` stay server-rendered; only this wrapper is client.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  // Nothing navigates inside an OBS browser source, so the transition has
  // nothing to smooth — and the transform it leaves behind becomes the
  // containing block for the overlay's positioning, which pulls it off centre.
  if (isOverlayRoute(usePathname())) return <>{children}</>;

  return (
    <m.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      {children}
    </m.div>
  );
}
