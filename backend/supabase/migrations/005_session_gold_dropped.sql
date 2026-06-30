-- Raw currency picked up during a grind session, in COPPER.
-- gold_earned stays the session TOTAL (item value + this); gold_dropped just
-- records how much of that total was raw currency rather than item drops.
alter table sessions add column if not exists gold_dropped bigint default 0;
