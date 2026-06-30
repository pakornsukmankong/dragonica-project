-- Add role column to profiles
alter table profiles add column if not exists role text default 'user';

-- To make a user admin, run:
-- update profiles set role = 'admin' where id = 'YOUR_USER_UUID';
