-- Community sharing for skill builds: an optional description, and an index for
-- listing public builds most-recent-first.
alter table skill_builds add column if not exists description text;

create index if not exists skill_builds_public_idx
  on skill_builds (visibility, created_at desc);
