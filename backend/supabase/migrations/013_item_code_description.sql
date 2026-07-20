-- Add an optional description to item codes — a short note on what the code
-- grants (e.g. "500 gold + 3-day mount").
--
-- Shipped as its own migration because 012 had already been applied to
-- production by the time this column was designed; re-running 012 there is a
-- no-op (`create table if not exists`), so the column must be added on top.
-- Idempotent, so it is also safe on fresh setups.

alter table item_codes add column if not exists description text;
