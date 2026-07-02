'use client';

import { toParts, toCopper } from '@/lib/currency';

const GOLD = 'var(--coin-gold)';
const SILVER = 'var(--coin-silver)';
const COPPER = 'var(--coin-copper)';

/**
 * Displays a total-copper amount with GOLD as the headline figure (bold, full
 * size) and silver/copper as small secondary detail — users care about gold
 * first; the finer denominations are there for precision.
 */
export function Currency({
  copper,
  className = '',
  showSub = true,
}: {
  copper: number;
  className?: string;
  /** Show the small silver/copper remainder after the gold figure. */
  showSub?: boolean;
}) {
  const { gold, silver, copper: c } = toParts(copper);
  const hasSub = silver > 0 || c > 0;

  return (
    <span
      className={`inline-flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 tabular-nums ${className}`}
    >
      <span className="font-bold" style={{ color: GOLD }}>
        {gold.toLocaleString()}
        <span className="text-[0.7em] font-semibold opacity-80">g</span>
      </span>
      {showSub && hasSub && (
        <span className="whitespace-nowrap text-[0.7em] font-medium">
          <span style={{ color: SILVER }}>{silver}s</span>{' '}
          <span style={{ color: COPPER }}>{c}c</span>
        </span>
      )}
    </span>
  );
}

/**
 * Three small inputs (gold / silver / copper) that emit a single total-copper
 * value. Silver and copper are capped at 99; overflow carries into gold on the
 * next render via the canonical copper value.
 */
// Silver/copper are always 0-99 (denomination rule). Gold can be capped per
// use (e.g. price fields) — values above the max snap back to the max.
const clamp = (n: number | string, max: number) =>
  Math.min(max, Math.max(0, Math.floor(Number(n) || 0)));

// Show an empty field (not "0") for a zero part, so a cleared/empty input reads
// as blank instead of a stray 0. Keep only digits from what the user types.
const partDisplay = (n: number) => (n === 0 ? '' : String(n));
const digitsOnly = (s: string) => s.replace(/[^0-9]/g, '');

export function CurrencyInput({
  value,
  onChange,
  className = '',
  maxGold = Number.MAX_SAFE_INTEGER,
}: {
  value: number;
  onChange: (copper: number) => void;
  className?: string;
  maxGold?: number;
}) {
  const { gold, silver, copper } = toParts(value);

  const field =
    'rounded-base border border-border bg-surface px-2 py-1.5 text-sm text-foreground text-right placeholder:text-muted outline-none focus:border-[var(--focus)]';
  const goldField = `${field} w-20 shrink-0`;
  const subField = `${field} w-12 shrink-0`;

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <input
        type="text"
        inputMode="numeric"
        value={partDisplay(gold)}
        onChange={(e) =>
          onChange(
            toCopper(clamp(digitsOnly(e.target.value), maxGold), silver, copper),
          )
        }
        className={goldField}
        placeholder="0"
        aria-label="Gold"
      />
      <span className="text-xs" style={{ color: GOLD }}>
        g
      </span>
      <input
        type="text"
        inputMode="numeric"
        value={partDisplay(silver)}
        onChange={(e) =>
          onChange(toCopper(gold, clamp(digitsOnly(e.target.value), 99), copper))
        }
        className={subField}
        placeholder="0"
        aria-label="Silver"
      />
      <span className="text-xs" style={{ color: SILVER }}>
        s
      </span>
      <input
        type="text"
        inputMode="numeric"
        value={partDisplay(copper)}
        onChange={(e) =>
          onChange(toCopper(gold, silver, clamp(digitsOnly(e.target.value), 99)))
        }
        className={subField}
        placeholder="0"
        aria-label="Copper"
      />
      <span className="text-xs" style={{ color: COPPER }}>
        c
      </span>
    </div>
  );
}
