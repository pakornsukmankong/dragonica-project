-- Lock down the public `assets` storage bucket (ticket screenshots, admin
-- dungeon/class images). The frontend uploads to it directly with the user's
-- session, so without these limits any signed-in user could host arbitrary
-- files (e.g. HTML) on the bucket's public URLs.
--
-- 1. Bucket-level enforcement (applies regardless of policies): images only,
--    5 MB cap.
update storage.buckets
   set file_size_limit    = 5242880,  -- 5 MB
       allowed_mime_types = array['image/png','image/jpeg','image/webp','image/gif']
 where id = 'assets';

-- 2. Reset object policies to a known state: public read, signed-in upload,
--    no client update/delete (the backend's service role bypasses RLS).
--    `assets` is this project's only bucket, so dropping every storage.objects
--    policy is safe; review first if you have added other buckets.
do $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
     where schemaname = 'storage' and tablename = 'objects'
  loop
    execute format('drop policy %I on storage.objects', pol.policyname);
  end loop;
end $$;

create policy "Public can view assets"
  on storage.objects for select
  using (bucket_id = 'assets');

create policy "Authenticated users can upload assets"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'assets');
