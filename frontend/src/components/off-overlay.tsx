'use client';

import { usePathname } from 'next/navigation';

/**
 * /overlay/* is rendered inside an OBS browser source, not read by a person: it
 * must be transparent, it has no session, and it stays open for the length of a
 * stream. Anything the rest of the site mounts globally is wrong there.
 */
export function isOverlayRoute(pathname: string) {
  return pathname === '/overlay' || pathname.startsWith('/overlay/');
}

/**
 * Keeps the analytics and ad tags out of the overlay. Beyond being pointless in
 * a source nobody browses, AdSense would be loading impressions that can never
 * be seen, on a page left open for hours — exactly the shape of traffic it
 * treats as invalid.
 */
export function OffOverlay({ children }: { children: React.ReactNode }) {
  return isOverlayRoute(usePathname()) ? null : <>{children}</>;
}
