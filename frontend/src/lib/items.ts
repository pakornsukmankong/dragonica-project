// Static item database (extracted from the Dragonica Chapter 5 client/DB).
// Items ship as per-category JSON under /data/items/<category>.json and are
// filtered client-side.

import type { RarityKey } from './rarity';

export const ITEM_CATEGORIES = [
  'equipment',
  'costume',
  'consume',
  'material',
  'quest',
  'pet',
  'etc',
] as const;
export type ItemCategory = (typeof ITEM_CATEGORIES)[number];

export interface GameItemIcon {
  /** Atlas sheet name under /item-atlas/<a>.webp */
  a: string;
  /** 1-based cell index, row-major */
  i: number;
  /** Grid columns / rows (mostly 12x12 sheets of 480x480) */
  u: number;
  v: number;
  /** Sheet [width, height] in px when not the default 480x480 */
  s?: [number, number];
}

export interface GameItem {
  id: number;
  name: string;
  desc?: string;
  slot?: EquipSlot;
  /** Present only for the few multi-slot items */
  slots?: EquipSlot[];
  weapon?: WeaponType;
  level: number;
  /** Class branch ids (21-28, same ids as skill classes); absent = all classes */
  classes?: number[];
  /** 1 = male, 2 = female, 0/3 = any */
  gender: number;
  price: number;
  sellPrice: number;
  rarity?: number;
  stats?: Partial<Record<StatKey, number>>;
  icon: GameItemIcon;
  /** Item set id — details live in /data/items/sets.json */
  set?: number;
  /** Number of known drop sources — details live in /data/items/drops.json */
  drops?: number;
}

/** One drop source: monster or map name + its level (monster level / map recommended level). */
export interface GameItemDropSource {
  n: string;
  l?: number;
}

export interface GameItemDrops {
  mons?: GameItemDropSource[];
  maps?: GameItemDropSource[];
}

/** Monster grades (AT 4007): 1 normal, 2 upgraded, 3 elite, 4 boss. */
export const MONSTER_GRADES = [1, 2, 3, 4] as const;
export type MonsterGrade = (typeof MONSTER_GRADES)[number];

export interface GameMonster {
  /** Name string id (variants deduped onto it) */
  id: number;
  name: string;
  lv: number;
  /** Present when variants span a level range */
  lvMax?: number;
  grade: MonsterGrade;
  hp?: number;
  /** [min, max] physical attack */
  atk?: [number, number];
  def?: number;
  mdef?: number;
  /** [min, max] copper dropped per kill */
  money?: [number, number];
  /** Maps this monster spawns in (l = map recommended level) */
  maps?: GameItemDropSource[];
  drops?: GameItemSetMember[];
}

export interface GameItemSetMember {
  id: number;
  name: string;
  level: number;
  icon: GameItemIcon;
}

export interface GameItemSet {
  id: number;
  name: string;
  members: GameItemSetMember[];
  /** Bonuses granted while wearing `pieces` items of the set */
  effects: { pieces: number; stats: Partial<Record<StatKey, number>> }[];
}

export const EQUIP_SLOTS = [
  'weapon',
  'shield',
  'helmet',
  'shirt',
  'pants',
  'glove',
  'boots',
  'shoulder',
  'cloak',
  'belt',
  'arm',
  'kickball',
  'glasses',
  'necklace',
  'earring',
  'ring',
  'medal',
  'hair',
  'hairColor',
  'face',
  'attstone',
] as const;
export type EquipSlot = (typeof EQUIP_SLOTS)[number];

export const SLOT_CATEGORY: Record<EquipSlot, 'weapon' | 'armor' | 'accessory'> =
  {
    weapon: 'weapon',
    shield: 'armor',
    helmet: 'armor',
    shirt: 'armor',
    pants: 'armor',
    glove: 'armor',
    boots: 'armor',
    shoulder: 'armor',
    cloak: 'armor',
    belt: 'armor',
    arm: 'armor',
    kickball: 'armor',
    glasses: 'accessory',
    necklace: 'accessory',
    earring: 'accessory',
    ring: 'accessory',
    medal: 'accessory',
    hair: 'accessory',
    hairColor: 'accessory',
    face: 'accessory',
    attstone: 'accessory',
  };

export const WEAPON_TYPES = [
  'sword',
  'twoHandSword',
  'staff',
  'gunStaff',
  'spear',
  'bow',
  'crossbow',
  'claw',
  'kattar',
  'twinGlove',
  'special',
  'jobTool',
] as const;
export type WeaponType = (typeof WEAPON_TYPES)[number];

// Display order for item stats; `rate` values are stored in 1/100 % units.
export const STAT_META = [
  { key: 'phyAtkMin', rate: false },
  { key: 'phyAtkMax', rate: false },
  { key: 'magAtkMin', rate: false },
  { key: 'magAtkMax', rate: false },
  { key: 'phyAtk', rate: false },
  { key: 'magAtk', rate: false },
  { key: 'phyDef', rate: false },
  { key: 'magDef', rate: false },
  { key: 'hp', rate: false },
  { key: 'mp', rate: false },
  { key: 'str', rate: false },
  { key: 'dex', rate: false },
  { key: 'int', rate: false },
  { key: 'con', rate: false },
  { key: 'atkSpeed', rate: true },
  { key: 'moveSpeed', rate: true },
  { key: 'critRate', rate: true },
  { key: 'critPower', rate: true },
  { key: 'hitRate', rate: true },
  { key: 'dodge', rate: true },
  { key: 'block', rate: true },
  { key: 'hpRecovery', rate: true },
  { key: 'mpRecovery', rate: true },
  { key: 'hpOnHitRate', rate: true },
  { key: 'hpOnHit', rate: false },
  { key: 'atkRange', rate: false },
  // set-effect-only stats
  { key: 'hpPct', rate: true },
  { key: 'phyDefPct', rate: true },
  { key: 'magDefPct', rate: true },
  { key: 'phyAtkMaxPct', rate: true },
  { key: 'atkRangePct', rate: true },
  { key: 'moveSpeedFlat', rate: false },
  { key: 'dmgReduce', rate: false },
] as const;
export type StatKey = (typeof STAT_META)[number]['key'];

/** Class branch id -> first-stage icon in /public/class-icons (Landverse names). */
export const BRANCH_ICON: Record<number, string> = {
  21: 'knight',
  22: 'gladiator',
  23: 'acolyte',
  24: 'battlemage',
  25: 'hunter',
  26: 'ranger',
  27: 'jester',
  28: 'assassin',
};
export const BRANCH_IDS = [21, 22, 23, 24, 25, 26, 27, 28];

export function formatStatValue(key: StatKey, value: number): string {
  const meta = STAT_META.find((m) => m.key === key);
  const sign = value > 0 ? '+' : '';
  if (meta?.rate) return `${sign}${(value / 100).toLocaleString()}%`;
  return `${sign}${value.toLocaleString()}`;
}

// Ordered rarity tiers (low → high), reusing the app-wide palette in rarity.ts.
export const RARITY_ORDER: RarityKey[] = [
  'common',
  'uncommon',
  'rare',
  'epic',
  'legendary',
];

// Gear carries its tier as a leading name tag ([Normal] < [Rare] < [Hero],
// mirroring the in-game white/blue/gold colors). Achievement medals/titles
// instead use the numeric `rarity` field (1-4). The two systems are disjoint.
const PREFIX_RARITY: Record<string, RarityKey> = {
  normal: 'common',
  superior: 'uncommon',
  rare: 'rare',
  premium: 'epic',
  hero: 'legendary',
};
const FIELD_RARITY: Record<number, RarityKey> = {
  1: 'common',
  2: 'uncommon',
  3: 'rare',
  4: 'legendary',
};

/** Resolve an item's rarity tier, or null when it carries no rarity signal. */
export function itemRarity(item: GameItem): RarityKey | null {
  const tag = item.name.match(/^\s*\*?\[([^\]]+)\]/);
  if (tag) {
    const hit = PREFIX_RARITY[tag[1].toLowerCase()];
    if (hit) return hit;
  }
  if (item.rarity != null) return FIELD_RARITY[item.rarity] ?? null;
  return null;
}
