-- Add image_url to dungeons
alter table dungeons add column if not exists image_url text;

-- items already has icon_url column
