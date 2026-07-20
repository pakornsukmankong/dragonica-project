-- Community-collected Dragonica item codes. Any logged-in user may add a code;
-- everyone (guests included) can read the list and copy codes. The API stores
-- each code already trimmed + uppercased and checks for duplicates before
-- inserting; the unique index below is the real guard so a direct API/DB write
-- cannot slip a case-variant duplicate past.

create table if not exists item_codes (
  id          uuid primary key default gen_random_uuid(),
  code        text not null,
  start_date  timestamptz,
  expire_date timestamptz,
  -- Keep the code if its author later deletes their account (community data).
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Case-insensitive uniqueness. Codes are stored uppercased, but matching on
-- upper() keeps the guard correct even if a row is ever written directly.
create unique index if not exists item_codes_code_unique
  on item_codes (upper(code));

-- Active-first / soonest-expiry ordering is computed by the client (status is a
-- function of the viewer's current time); this index backs the newest-first
-- fetch. Ownership checks filter on the primary key, so they need no index.
create index if not exists item_codes_created_at_idx
  on item_codes (created_at desc);

-- RLS (defense in depth; the backend uses the service role, which bypasses it).
alter table item_codes enable row level security;

drop policy if exists "Anyone can view item codes" on item_codes;
create policy "Anyone can view item codes"
  on item_codes for select
  using (true);

drop policy if exists "Users can add item codes" on item_codes;
create policy "Users can add item codes"
  on item_codes for insert
  with check (auth.uid() = created_by);
