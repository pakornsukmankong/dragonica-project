-- Class image shown in the character form's class picker and the admin
-- Classes tab. Managed by admins (upload to Supabase Storage, then
-- PATCH /api/admin/classes/:id) — mirrors dungeons.image_url.
alter table classes add column if not exists image_url text;
