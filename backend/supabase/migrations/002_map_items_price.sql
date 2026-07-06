-- Add price_each to session_drops
alter table session_drops add column if not exists price_each bigint default 0;

-- Add default_price to items (global price, not per dungeon)
alter table items add column if not exists default_price bigint default 0;

-- Seed some example maps and dungeons
insert into maps (name, level_min, level_max) values
  ('Port Of Winds', 30, 40),
  ('Libra', 40, 50),
  ('Secret Laboratory', 50, 60),
  ('Frozen Tower', 55, 65),
  ('Dragon Nest', 60, 70),
  ('Cascada Cave', 45, 55)
on conflict do nothing;

-- Seed some example items with default prices
insert into items (name, rarity, default_price) values
  ('Dragon Scale', 'rare', 280000),
  ('Magic Crystal', 'uncommon', 196000),
  ('Gold Bar', 'common', 19000),
  ('Enchanted Stone', 'rare', 3000000),
  ('Hero Medal', 'epic', 198000000),
  ('Phoenix Feather', 'legendary', 10000000),
  ('Ancient Coin', 'common', 30000),
  ('Soul Fragment', 'uncommon', 57000),
  ('Mystic Ore', 'rare', 5600000)
on conflict do nothing;
