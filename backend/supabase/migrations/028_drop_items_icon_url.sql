-- Item icons now come solely from the sprite-atlas `icon` column (027);
-- the admin image-upload flow for items is removed, so the URL column goes.
-- NOTE: destructive — any admin-uploaded item icons are lost.
alter table items drop column if exists icon_url;
