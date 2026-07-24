import type { Metadata } from 'next';
import { OverlayView, type OverlayOptions } from './overlay-view';

/**
 * Stream overlay for the run counter, loaded by an OBS browser source.
 *
 * Lives outside /grind on purpose: OBS carries no session cookie, and every
 * /grind route is bounced to /login by middleware. The token in the path is what
 * stands in for auth.
 */
export const metadata: Metadata = {
  title: 'Run overlay',
  robots: { index: false, follow: false },
};

type Search = Record<string, string | string[] | undefined>;

function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

/** Everything below is interpolated into markup or CSS, so nothing is trusted. */
function readOptions(sp: Search): OverlayOptions {
  const size = Number(one(sp.size));
  const accent = one(sp.accent)?.replace(/^#/, '') ?? '';
  const label = one(sp.label);
  return {
    size: Number.isFinite(size) ? Math.min(300, Math.max(16, size)) : 64,
    accent: /^[0-9a-fA-F]{3,8}$/.test(accent) ? `#${accent}` : '#e0a53c',
    label: (label ?? 'รอบ').slice(0, 24),
    stamina: one(sp.stamina) === '1',
    dot: one(sp.dot) !== '0',
    align:
      one(sp.align) === 'center'
        ? 'center'
        : one(sp.align) === 'right'
          ? 'right'
          : 'left',
  };
}

export default async function OverlayPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Search>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  return <OverlayView token={token} opts={readOptions(sp)} />;
}
