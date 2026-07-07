/**
 * A shimmering placeholder for loading states. Pure CSS (see `.skeleton` in
 * globals.css) — no animation library, and the shimmer honours
 * prefers-reduced-motion. Compose with width/height utility classes.
 */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton rounded-base ${className}`} />;
}
