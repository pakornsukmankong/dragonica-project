-- Free-text note a user can attach to a grinding session (party comp, buffs,
-- events, anything worth remembering about the run).
alter table sessions add column if not exists note text;
