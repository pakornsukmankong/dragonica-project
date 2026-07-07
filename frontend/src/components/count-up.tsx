'use client';

import { useCountUp } from '@/hooks/use-count-up';
import { Currency } from '@/components/currency';

/** A plain integer that counts up to `value` on mount (locale-grouped). */
export function CountUp({
  value,
  className = '',
}: {
  value: number;
  className?: string;
}) {
  const n = useCountUp(value);
  return (
    <span className={`tabular-nums ${className}`}>{n.toLocaleString()}</span>
  );
}

/** A <Currency> whose copper amount counts up to `copper` on mount. */
export function CountUpCurrency({
  copper,
  className = '',
}: {
  copper: number;
  className?: string;
}) {
  const c = useCountUp(copper);
  return <Currency copper={c} className={className} />;
}
