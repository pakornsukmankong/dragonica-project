// Dragonica currency: Gold / Silver / Copper.
// 100 Copper = 1 Silver, 100 Silver = 1 Gold  →  1 Gold = 10,000 Copper.
//
// Canonical storage/transport value is ALWAYS total copper (an integer), so all
// math stays exact. Use these helpers to convert and display.

export const COPPER_PER_SILVER = 100;
export const SILVER_PER_GOLD = 100;
export const COPPER_PER_GOLD = COPPER_PER_SILVER * SILVER_PER_GOLD; // 10,000

export interface CoinParts {
  gold: number;
  silver: number;
  copper: number;
}

/** Split a total-copper amount into gold/silver/copper denominations. */
export function toParts(totalCopper: number): CoinParts {
  const t = Math.max(0, Math.round(Number(totalCopper) || 0));
  return {
    gold: Math.floor(t / COPPER_PER_GOLD),
    silver: Math.floor((t % COPPER_PER_GOLD) / COPPER_PER_SILVER),
    copper: t % COPPER_PER_SILVER,
  };
}

/** Combine gold/silver/copper into a single total-copper integer. */
export function toCopper(gold: number, silver: number, copper: number): number {
  const g = Math.max(0, Math.floor(Number(gold) || 0));
  const s = Math.max(0, Math.floor(Number(silver) || 0));
  const c = Math.max(0, Math.floor(Number(copper) || 0));
  return g * COPPER_PER_GOLD + s * COPPER_PER_SILVER + c;
}

/**
 * Plain-text format, e.g. "12g 34s 56c". Leading zero denominations are
 * dropped, but copper is always shown so "0c" represents an empty amount.
 */
export function formatCoins(totalCopper: number): string {
  const { gold, silver, copper } = toParts(totalCopper);
  const parts: string[] = [];
  if (gold > 0) parts.push(`${gold.toLocaleString()}g`);
  if (silver > 0 || gold > 0) parts.push(`${silver}s`);
  parts.push(`${copper}c`);
  return parts.join(' ');
}

/**
 * Compact gold-major form for tight spaces (chart axes/labels): "12g",
 * "1.2Kg", "3.4Mg". Sub-gold amounts fall back to silver.
 */
export function formatGoldShort(totalCopper: number): string {
  const gold = (Number(totalCopper) || 0) / COPPER_PER_GOLD;
  if (gold >= 1_000_000) return `${(gold / 1_000_000).toFixed(1)}Mg`;
  if (gold >= 1_000) return `${(gold / 1_000).toFixed(1)}Kg`;
  if (gold >= 1) return `${Math.round(gold)}g`;
  const silver = (Number(totalCopper) || 0) / COPPER_PER_SILVER;
  if (silver >= 1) return `${Math.round(silver)}s`;
  return `${Math.round(Number(totalCopper) || 0)}c`;
}
