'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Animates a number from 0 up to `target` over `durationMs` using
 * requestAnimationFrame (easeOutCubic). Bundle-free — no animation library —
 * and cheap: it only updates a number in state, so consumers repaint text
 * without triggering layout. Honours prefers-reduced-motion by jumping
 * straight to the final value.
 *
 * Note: render the value WITHOUT aria-live, otherwise a screen reader will
 * announce every intermediate frame.
 */
export function useCountUp(target: number, durationMs = 900): number {
  // Start at 0 so the very first paint shows the start of the count, not a
  // flash of the final value that then restarts from 0.
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const reduce = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    if (reduce || target === 0) {
      setValue(target);
      return;
    }

    let start: number | null = null;
    const from = 0;
    const tick = (now: number) => {
      if (start === null) start = now;
      const t = Math.min((now - start) / durationMs, 1);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setValue(Math.round(from + (target - from) * eased));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, durationMs]);

  return value;
}
