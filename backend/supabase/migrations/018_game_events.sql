-- Community-collected Dragonica event timetable. Any logged-in user may add an
-- event (name, start/end date, optional detail and a link to the game's own
-- page); everyone — guests included — can read the calendar. Events appear on
-- the timetable immediately; an admin can remove any entry after the fact
-- (there is no approval queue). The author may edit/delete only their own rows.

create table if not exists game_events (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  -- Day-level range. end_date is inclusive (an event that runs 1–3 Jul covers
  -- all three days). end_date >= start_date is enforced by the API and the
  -- check below so a direct write cannot store an inverted range.
  start_date date not null,
  end_date   date not null,
  detail     text,
  -- Optional deep link into the official game site (an event page, patch note,
  -- etc.). Stored as-is; the API validates it is a http(s) URL.
  link       text,
  -- Keep the event if its author later deletes their account (community data).
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint game_events_date_order check (end_date >= start_date)
);

-- The calendar fetches a month at a time by overlapping range, so both bounds
-- are queried. Index the start date (the common lower-bound filter); the range
-- is small enough per month that a second index is not worth its write cost.
create index if not exists game_events_start_date_idx
  on game_events (start_date);

-- RLS (defense in depth; the backend uses the service role, which bypasses it).
alter table game_events enable row level security;

drop policy if exists "Anyone can view game events" on game_events;
create policy "Anyone can view game events"
  on game_events for select
  using (true);

drop policy if exists "Users can add game events" on game_events;
create policy "Users can add game events"
  on game_events for insert
  with check (auth.uid() = created_by);

drop policy if exists "Users can edit their own game events" on game_events;
create policy "Users can edit their own game events"
  on game_events for update
  using (auth.uid() = created_by);

drop policy if exists "Users can delete their own game events" on game_events;
create policy "Users can delete their own game events"
  on game_events for delete
  using (auth.uid() = created_by);
