-- Remove the "maps" concept entirely. Dungeons are now standalone (no map).
-- Drop the FK column first, then the table (cascade clears its RLS policy too).
alter table dungeons drop column if exists map_id;
drop table if exists maps cascade;
