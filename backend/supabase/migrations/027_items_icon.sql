-- Sprite-atlas icon for items ensured from the static game database
-- ({a, i, u, v, s?} — see frontend/src/lib/items.ts GameItemIcon), so
-- session-drop lists can render the same icon the grind picker showed.
-- Admin-seeded items keep using icon_url instead.
alter table items add column if not exists icon jsonb;
