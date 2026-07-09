-- Social features for community skill builds: likes, comments, view counts.
-- Counts are denormalized onto skill_builds and kept exact by triggers so the
-- gallery can sort by popularity without join aggregates.

alter table skill_builds add column if not exists like_count integer not null default 0;
alter table skill_builds add column if not exists view_count integer not null default 0;
alter table skill_builds add column if not exists comment_count integer not null default 0;

-- One like per user per build; the composite primary key is the dedupe guard.
create table if not exists skill_build_likes (
  build_id   uuid not null references skill_builds(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (build_id, user_id)
);

create table if not exists skill_build_comments (
  id         uuid primary key default gen_random_uuid(),
  build_id   uuid not null references skill_builds(id) on delete cascade,
  author_id  uuid not null references profiles(id) on delete cascade,
  body       text not null,
  created_at timestamptz default now()
);

-- Thread in chronological order (mirrors ticket_messages index).
create index if not exists skill_build_comments_build_id_idx
  on skill_build_comments (build_id, created_at);

-- Popular sort in the public gallery.
create index if not exists skill_builds_popular_idx
  on skill_builds (visibility, like_count desc, created_at desc);

-- Keep skill_builds.like_count exact under concurrent likes and unlikes.
create or replace function public.bump_build_like_count()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update skill_builds set like_count = like_count + 1 where id = new.build_id;
    return new;
  else
    update skill_builds set like_count = greatest(like_count - 1, 0) where id = old.build_id;
    return old;
  end if;
end;
$$;

drop trigger if exists skill_build_likes_count_trg on skill_build_likes;
create trigger skill_build_likes_count_trg
  after insert or delete on skill_build_likes
  for each row execute function public.bump_build_like_count();

-- Same pattern for comment_count.
create or replace function public.bump_build_comment_count()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update skill_builds set comment_count = comment_count + 1 where id = new.build_id;
    return new;
  else
    update skill_builds set comment_count = greatest(comment_count - 1, 0) where id = old.build_id;
    return old;
  end if;
end;
$$;

drop trigger if exists skill_build_comments_count_trg on skill_build_comments;
create trigger skill_build_comments_count_trg
  after insert or delete on skill_build_comments
  for each row execute function public.bump_build_comment_count();

-- Atomic view increment by share slug; returns the new count.
create or replace function public.increment_build_view(build_slug text)
returns integer language sql as $$
  update skill_builds
     set view_count = view_count + 1
   where share_slug = build_slug
  returning view_count;
$$;

-- Only the backend (service role) may call this; direct anon RPC would bypass
-- the API rate limit.
revoke execute on function public.increment_build_view(text) from anon, authenticated;

-- RLS (defense in depth; the backend uses the service role).
alter table skill_build_likes enable row level security;
alter table skill_build_comments enable row level security;

drop policy if exists "Anyone can view build likes" on skill_build_likes;
create policy "Anyone can view build likes"
  on skill_build_likes for select
  using (true);

drop policy if exists "Users can like builds" on skill_build_likes;
create policy "Users can like builds"
  on skill_build_likes for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can remove own likes" on skill_build_likes;
create policy "Users can remove own likes"
  on skill_build_likes for delete
  using (auth.uid() = user_id);

drop policy if exists "Anyone can view build comments" on skill_build_comments;
create policy "Anyone can view build comments"
  on skill_build_comments for select
  using (true);

drop policy if exists "Users can comment on builds" on skill_build_comments;
create policy "Users can comment on builds"
  on skill_build_comments for insert
  with check (auth.uid() = author_id);

drop policy if exists "Users can delete own comments" on skill_build_comments;
create policy "Users can delete own comments"
  on skill_build_comments for delete
  using (auth.uid() = author_id);
