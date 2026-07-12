-- Grind drops can now be picked from the static game item database. Rows
-- created that way carry the game's item id so repeat picks reuse the same
-- row instead of duplicating it. Admin-created rows keep a null game_item_id.
alter table items add column if not exists game_item_id bigint;
create unique index if not exists idx_items_game_item_id
  on items(game_item_id) where game_item_id is not null;
