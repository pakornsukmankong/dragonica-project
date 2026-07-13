// Regenerates backend/game-data/items-manifest.json from the frontend's
// static game item database, so /game-data/items/ensure can take an item's
// name/rarity/icon from a server-side source of truth instead of trusting the
// client (which would let one user poison the shared items row).
//
// Run from backend/:  node scripts/build-items-manifest.mjs
// Re-run whenever frontend/public/data/items/*.json changes.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const itemsDir = path.join(here, '..', '..', 'frontend', 'public', 'data', 'items');
const outFile = path.join(here, '..', 'game-data', 'items-manifest.json');

const CATEGORIES = ['equipment', 'costume', 'consume', 'material', 'quest', 'pet', 'etc'];

// Rarity resolution — mirrors frontend/src/lib/items.ts itemRarity().
const PREFIX_RARITY = {
  normal: 'common',
  superior: 'uncommon',
  rare: 'rare',
  premium: 'epic',
  hero: 'legendary',
};
const FIELD_RARITY = { 1: 'common', 2: 'uncommon', 3: 'rare', 4: 'legendary' };

function itemRarity(item) {
  const tag = item.name.match(/^\s*\*?\[([^\]]+)\]/);
  if (tag) {
    const hit = PREFIX_RARITY[tag[1].toLowerCase()];
    if (hit) return hit;
  }
  if (item.rarity != null) return FIELD_RARITY[item.rarity] ?? null;
  return null;
}

const manifest = {};
let total = 0;
for (const cat of CATEGORIES) {
  const items = JSON.parse(fs.readFileSync(path.join(itemsDir, `${cat}.json`), 'utf8'));
  for (const it of items) {
    total += 1;
    // Ids are globally unique across categories in practice; keep the first
    // occurrence to match the deduped picker.
    if (manifest[it.id]) continue;
    manifest[it.id] = { n: it.name, r: itemRarity(it), i: it.icon };
  }
}

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(manifest));
console.log(
  `items-manifest.json: ${Object.keys(manifest).length} unique items (from ${total} rows), ` +
    `${(fs.statSync(outFile).size / 1024 / 1024).toFixed(2)} MB`,
);
