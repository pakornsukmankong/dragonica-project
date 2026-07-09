-- Extra skill points a build adds by hand (quest/event SP not derived from level).
alter table skill_builds add column if not exists bonus_sp integer not null default 0;
