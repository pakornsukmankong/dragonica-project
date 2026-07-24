'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  OVERLAY_EVENT,
  OVERLAY_STALE_MS,
  overlayChannel,
  type OverlayState,
} from '@/lib/run-overlay';

export type OverlayOptions = {
  size: number;
  accent: string;
  label: string;
  stamina: boolean;
  dot: boolean;
  align: 'left' | 'center' | 'right';
  valign: 'top' | 'middle' | 'bottom';
  /** Outline width on the number, in px; the smaller text scales down from it. */
  stroke: number;
};

const JUSTIFY = { top: 'flex-start', middle: 'center', bottom: 'flex-end' };
const ALIGN = { left: 'flex-start', center: 'center', right: 'flex-end' };

/**
 * The OBS browser source. Deliberately styled with its own <style> block rather
 * than the app's utility classes: it has to punch a transparent hole through the
 * site background, and it is read at a glance over arbitrary game footage, so
 * every value here is about legibility rather than matching the site.
 */
export function OverlayView({
  token,
  opts,
}: {
  token: string;
  opts: OverlayOptions;
}) {
  const [state, setState] = useState<OverlayState | null>(null);
  const [live, setLive] = useState(false);
  const seenRef = useRef(0);

  useEffect(() => {
    const supabase = createClient();
    const ch = supabase.channel(overlayChannel(token));
    ch.on('broadcast', { event: OVERLAY_EVENT }, ({ payload }) => {
      const s = payload as OverlayState;
      if (typeof s?.count !== 'number') return;
      seenRef.current = Date.now();
      setLive(true);
      setState(s);
    }).subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [token]);

  // Going stale is the absence of an event, so only a timer can notice it: the
  // counter tab being closed mid-stream must not leave a confident-looking
  // number frozen on screen.
  useEffect(() => {
    const id = setInterval(() => {
      setLive(Date.now() - seenRef.current < OVERLAY_STALE_MS);
    }, 2000);
    return () => clearInterval(id);
  }, []);

  const count = state?.count ?? 0;

  return (
    <>
      {/* OBS composites whatever the page paints, so the site's own background
          would arrive as an opaque rectangle. */}
      <style>{`
        html, body {
          background: transparent !important;
          background-image: none !important;
          margin: 0;
          overflow: hidden;
        }
        /* A browser source is a fixed box positioned in OBS, not a page anyone
           scrolls, so the content fills it and is placed within it — otherwise
           it clings to the top-left corner of whatever size the source was
           given, and lining it up means resizing the source to fit the text. */
        .ov-root {
          /* Pinned to the viewport rather than laid out in flow: whatever the
             app wraps a page in must not shift the overlay inside its source.
             Longhand insets, since OBS ships an older Chromium than the browser
             this was written in. */
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          left: 0;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
        }
        .ov {
          display: flex;
          align-items: baseline;
          gap: 0.25em;
          padding: 8px 12px;
          line-height: 1;
          color: #fff;
          font-variant-numeric: tabular-nums;
          font-weight: 700;
          /* Readable over both a bright sky and a dark dungeon. */
          text-shadow:
            0 0 4px rgba(0, 0, 0, 0.9),
            0 2px 6px rgba(0, 0, 0, 0.8),
            0 0 18px rgba(0, 0, 0, 0.6);
        }
        /* The outline is what actually separates the text from the footage; the
           shadows above only lift it off. paint-order puts the stroke behind the
           fill, so a heavy outline thickens the glyph outwards instead of eating
           into it — without it the digits go spindly at high stroke widths. */
        .ov-n, .ov-label, .ov-sub { paint-order: stroke fill; }
        .ov-n {
          font-size: var(--ov-size);
          color: var(--ov-accent);
          display: inline-block;
          -webkit-text-stroke: var(--ov-stroke) #000;
        }
        /* Secondary text keeps more outline than its size alone would suggest:
           scaled purely in proportion it disappears against busy footage, which
           is exactly where the outline is needed. */
        .ov-label {
          font-size: calc(var(--ov-size) * 0.34);
          opacity: 0.92;
          -webkit-text-stroke: calc(var(--ov-stroke) * 0.6) #000;
        }
        .ov-sub {
          font-size: calc(var(--ov-size) * 0.24);
          font-weight: 600;
          opacity: 0.8;
          padding: 0 12px 8px;
          color: #fff;
          text-shadow: 0 0 4px rgba(0, 0, 0, 0.9), 0 2px 6px rgba(0, 0, 0, 0.8);
          -webkit-text-stroke: calc(var(--ov-stroke) * 0.55) #000;
        }
        .ov-dot {
          width: 0.28em;
          height: 0.28em;
          border-radius: 50%;
          align-self: center;
          background: #46c46b;
          box-shadow: 0 0 6px rgba(0, 0, 0, 0.8);
        }
        .ov-dot.off { background: #d8514b; }
        /* Keyed on the count, so it replays on every new run. */
        @keyframes ov-pop {
          0%   { transform: translateY(0.12em) scale(0.88); opacity: 0.4; }
          60%  { transform: translateY(0) scale(1.06); opacity: 1; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        .ov-pop { animation: ov-pop 420ms cubic-bezier(0.2, 0.9, 0.3, 1.4); }
      `}</style>

      <div
        className="ov-root"
        style={
          {
            '--ov-size': `${opts.size}px`,
            '--ov-accent': opts.accent,
            '--ov-stroke': `${opts.stroke}px`,
            alignItems: ALIGN[opts.align],
            justifyContent: JUSTIFY[opts.valign],
          } as React.CSSProperties
        }
      >
        <div className="ov">
          {opts.dot && (
            <span
              className={live ? 'ov-dot' : 'ov-dot off'}
              title={live ? 'connected' : 'no signal'}
            />
          )}
          <span key={count} className="ov-n ov-pop">
            {count}
          </span>
          {opts.label && <span className="ov-label">{opts.label}</span>}
        </div>
        {opts.stamina && (
          <div className="ov-sub">{count * 20} stamina</div>
        )}
      </div>
    </>
  );
}
