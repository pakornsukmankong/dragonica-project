-- Skill Simulator - reference skill data + user-created skill builds.
--
-- Skill data is imported from the Dragonica Chapter 5 definition DB
-- (TB_DefSkill_Player) joined with the client string table. It is READ-ONLY
-- reference data (like classes/items/dungeons) - public read, admin-managed.
--
-- A "class" here is one of the 8 human endgame classes, keyed by its in-game
-- ClassLimit bit (21..28). A skill may belong to several classes (shared base
-- skills), so `skills.class_bits` is an array of those bits.

-- The 8 buildable classes (natural key = in-game class bit).
create table if not exists skill_classes (
  id          integer primary key,             -- in-game ClassLimit bit (21..28)
  base_class  text not null,                    -- 'Warrior' | 'Magician' | 'Archer' | 'Thief'
  name        text not null,                    -- display name (editable)
  slug        text not null unique,             -- url slug, e.g. 'gladiator'
  sort_order  integer not null default 0
);

-- One row per skill (grouped across its levels). `levels` holds the per-level
-- numbers as jsonb: [{ level, reqLevel, mp, cooldown, castTime, range, abil[] }].
create table if not exists skills (
  id             bigint primary key,            -- in-game NameNo
  name           text not null,
  description    text,
  icon_url       text,
  type           smallint not null default 0,   -- in-game skill Type
  class_bits     integer[] not null default '{}',
  base_class     text,                           -- convenience denormalization
  req_level      integer not null default 0,     -- character level to learn (lv1)
  max_level      integer not null default 1,     -- skill points investable
  parent_skill_id bigint references skills(id),  -- (legacy, unused) single prereq
  weapon_limit   bigint not null default 0,
  -- skill-tree prerequisites: [{ id: skillId, level: requiredLevel }, ...]
  prerequisites  jsonb not null default '[]'::jsonb,
  -- per-class grid position { classBit: [tier, x, y] } (Dragonica sim layout)
  positions      jsonb not null default '{}'::jsonb,
  levels         jsonb not null default '[]'::jsonb,
  created_at     timestamptz default now()
);

create index if not exists skills_class_bits_idx on skills using gin (class_bits);
create index if not exists skills_base_class_idx on skills (base_class);

-- A saved skill build. `allocations` maps skill_id -> points, e.g. {"2000101001": 5}.
create table if not exists skill_builds (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles(id) on delete cascade,
  class_id     integer not null references skill_classes(id),
  name         text not null default 'Untitled Build',
  char_level   integer not null default 100,
  allocations  jsonb not null default '{}'::jsonb,
  visibility   text not null default 'unlisted',   -- 'public' | 'unlisted'
  share_slug   text not null unique,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create index if not exists skill_builds_user_id_idx on skill_builds (user_id);
create index if not exists skill_builds_class_id_idx on skill_builds (class_id);

-- Reference tables: public read (backend writes via service role).
alter table skill_classes enable row level security;
alter table skills enable row level security;
alter table skill_builds enable row level security;

-- (drop-if-exists first so this migration is safe to re-run)
drop policy if exists "Anyone can view skill classes" on skill_classes;
create policy "Anyone can view skill classes" on skill_classes for select using (true);

drop policy if exists "Anyone can view skills" on skills;
create policy "Anyone can view skills" on skills for select using (true);

-- Builds: owner has full access; public builds are readable by anyone.
drop policy if exists "Users can view own or public builds" on skill_builds;
create policy "Users can view own or public builds"
  on skill_builds for select
  using (auth.uid() = user_id or visibility = 'public');

drop policy if exists "Users can insert own builds" on skill_builds;
create policy "Users can insert own builds"
  on skill_builds for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own builds" on skill_builds;
create policy "Users can update own builds"
  on skill_builds for update using (auth.uid() = user_id);

drop policy if exists "Users can delete own builds" on skill_builds;
create policy "Users can delete own builds"
  on skill_builds for delete using (auth.uid() = user_id);

-- Seed the 8 endgame classes with their full job path (1st -> 2nd -> 3rd job),
-- matching the Dragon Saga class names. Upsert so re-running fixes names.
insert into skill_classes (id, base_class, name, slug, sort_order) values
  (21, 'Warrior',  'Knight → Paladin → Dragoon',         'dragoon',      1),
  (22, 'Warrior',  'Gladiator → Myrmidon → Berserker',   'berserker',    2),
  (23, 'Magician', 'Monk → Priest → Cleric',             'cleric',       3),
  (24, 'Magician', 'Battlemage → Archmage → Chaosmage',  'chaosmage',    4),
  (25, 'Archer',   'Pathfinder → Ranger → Sentinel',     'sentinel',     5),
  (26, 'Archer',   'Arbalist → Grenadier → Bombardier',  'bombardier',   6),
  (27, 'Thief',    'Jester → Harlequin → Joker',         'joker',        7),
  (28, 'Thief',    'Assassin → Ninja → Shadow Walker',   'shadow-walker', 8)
on conflict (id) do update
  set base_class = excluded.base_class,
      name = excluded.name,
      slug = excluded.slug,
      sort_order = excluded.sort_order;
