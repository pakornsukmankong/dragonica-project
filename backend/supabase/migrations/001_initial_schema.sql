-- Dragonica Grind Tracker - Initial Schema
-- Run this in Supabase SQL Editor

-- Profiles (synced with Supabase Auth users)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  avatar_url text,
  created_at timestamptz default now()
);

-- Classes (Warrior, Archer, etc.)
create table if not exists classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  parent_class text,
  created_at timestamptz default now()
);

-- Characters
create table if not exists characters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  class_id uuid not null references classes(id),
  name text not null,
  level integer default 1,
  created_at timestamptz default now()
);

-- Maps
create table if not exists maps (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  level_min integer,
  level_max integer
);

-- Dungeons
create table if not exists dungeons (
  id uuid primary key default gen_random_uuid(),
  map_id uuid references maps(id),
  name text not null,
  dragon_core_cost integer,
  average_duration integer
);

-- Items
create table if not exists items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  icon_url text,
  rarity text
);

-- Grinding Sessions
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  character_id uuid not null references characters(id),
  dungeon_id uuid references dungeons(id),
  started_at timestamptz,
  ended_at timestamptz,
  duration_minutes integer,
  gold_earned bigint default 0,
  created_at timestamptz default now()
);

-- Session Drops
create table if not exists session_drops (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  item_id uuid not null references items(id),
  quantity integer default 1
);

-- Indexes
create index if not exists idx_characters_user_id on characters(user_id);
create index if not exists idx_sessions_user_id on sessions(user_id);
create index if not exists idx_sessions_character_id on sessions(character_id);
create index if not exists idx_session_drops_session_id on session_drops(session_id);

-- Row Level Security (RLS)
alter table profiles enable row level security;
alter table characters enable row level security;
alter table sessions enable row level security;
alter table session_drops enable row level security;

-- Policies: Users can only access their own data
create policy "Users can view own profile"
  on profiles for select using (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);

create policy "Users can view own characters"
  on characters for select using (auth.uid() = user_id);

create policy "Users can insert own characters"
  on characters for insert with check (auth.uid() = user_id);

create policy "Users can update own characters"
  on characters for update using (auth.uid() = user_id);

create policy "Users can delete own characters"
  on characters for delete using (auth.uid() = user_id);

create policy "Users can view own sessions"
  on sessions for select using (auth.uid() = user_id);

create policy "Users can insert own sessions"
  on sessions for insert with check (auth.uid() = user_id);

create policy "Users can update own sessions"
  on sessions for update using (auth.uid() = user_id);

create policy "Users can delete own sessions"
  on sessions for delete using (auth.uid() = user_id);

create policy "Users can view own session drops"
  on session_drops for select
  using (
    session_id in (select id from sessions where user_id = auth.uid())
  );

create policy "Users can insert own session drops"
  on session_drops for insert
  with check (
    session_id in (select id from sessions where user_id = auth.uid())
  );

create policy "Users can delete own session drops"
  on session_drops for delete
  using (
    session_id in (select id from sessions where user_id = auth.uid())
  );

-- Public read for reference tables
alter table classes enable row level security;
alter table maps enable row level security;
alter table dungeons enable row level security;
alter table items enable row level security;

create policy "Anyone can view classes"
  on classes for select using (true);

create policy "Anyone can view maps"
  on maps for select using (true);

create policy "Anyone can view dungeons"
  on dungeons for select using (true);

create policy "Anyone can view items"
  on items for select using (true);

-- Seed data: Classes
insert into classes (name, parent_class) values
  ('Warrior', null),
  ('Knight', 'Warrior'),
  ('Gladiator', 'Warrior'),
  ('Archer', null),
  ('Hunter', 'Archer'),
  ('Ranger', 'Archer'),
  ('Magician', null),
  ('Monk', 'Magician'),
  ('Battle Mage', 'Magician'),
  ('Thief', null),
  ('Assassin', 'Thief'),
  ('Jester', 'Thief')
on conflict do nothing;

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username)
  values (new.id, new.raw_user_meta_data->>'username');
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
