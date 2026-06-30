// Item rarity → color, shared by the grind logger and admin catalog.
// Colors mirror the --rarity-* tokens in globals.css.

export type RarityKey =
  | 'common'
  | 'uncommon'
  | 'rare'
  | 'epic'
  | 'legendary';

type RarityStyle = {
  key: RarityKey;
  label: string;
  color: string;
  soft: string;
};

const RARITY: Record<RarityKey, RarityStyle> = {
  common: { key: 'common', label: 'Common', color: '#b8bcc6', soft: 'rgba(184,188,198,0.12)' },
  uncommon: { key: 'uncommon', label: 'Uncommon', color: '#5fd17a', soft: 'rgba(95,209,122,0.12)' },
  rare: { key: 'rare', label: 'Rare', color: '#4ea1f0', soft: 'rgba(78,161,240,0.12)' },
  epic: { key: 'epic', label: 'Epic', color: '#b07bf0', soft: 'rgba(176,123,240,0.14)' },
  legendary: { key: 'legendary', label: 'Legendary', color: '#e0a53c', soft: 'rgba(224,165,60,0.14)' },
};

// Tolerant lookup: case-insensitive, falls back to "common" for unknown/empty.
export function rarityStyle(rarity?: string | null): RarityStyle {
  const key = (rarity ?? '').trim().toLowerCase();
  return RARITY[key as RarityKey] ?? RARITY.common;
}
