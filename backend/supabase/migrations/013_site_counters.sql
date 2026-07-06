-- Site-wide counters shown publicly on the site (e.g. total page views).
-- A single row per counter key; incremented atomically so concurrent visits
-- never clobber each other.

create table if not exists public.site_counters (
  key text primary key,
  count bigint not null default 0,
  updated_at timestamptz not null default now()
);

-- Seed the page-view counter so the increment function always has a row to bump.
insert into public.site_counters (key, count)
values ('page_views', 0)
on conflict (key) do nothing;

-- Atomic increment. Returns the new value so the caller can respond without a
-- second round-trip.
create or replace function public.increment_counter(counter_key text)
returns bigint
language sql
as $$
  update public.site_counters
     set count = count + 1, updated_at = now()
   where key = counter_key
  returning count;
$$;
