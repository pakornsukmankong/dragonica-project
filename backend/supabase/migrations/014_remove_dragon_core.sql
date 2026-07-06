-- Remove the Dragon Core feature (unused).
--
-- 1. Drop the dungeon core-cost column that fed the gold-per-core metric.
-- 2. Delete the seeded 'Dragon Core' catalog item.
--
-- session_drops.item_id references items(id) WITHOUT on-delete-cascade, so any
-- logged drops of 'Dragon Core' must be removed first or the delete would fail.
-- WARNING: this deletes those drop records.

alter table dungeons drop column if exists dragon_core_cost;

delete from session_drops
 where item_id in (select id from items where name = 'Dragon Core');

delete from items where name = 'Dragon Core';
