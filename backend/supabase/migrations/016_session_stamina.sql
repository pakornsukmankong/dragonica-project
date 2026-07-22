-- Stamina-based grinding sessions
-- Some runs are better measured by the stamina they burn than by the time they
-- take — stamina is the resource the game actually limits. `stamina_used` sits
-- alongside `duration_minutes` (both nullable) so a session can be logged with
-- either, or with both.
alter table sessions
  add column if not exists stamina_used integer;

do $$
begin
  alter table sessions
    add constraint sessions_stamina_used_non_negative
    check (stamina_used is null or stamina_used >= 0);
exception
  when duplicate_object then null;
end $$;
