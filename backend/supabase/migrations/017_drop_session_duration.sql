-- Retire the time-based grind log.
--
-- Runs are now measured only by the stamina they burn (see 016), so the old
-- duration column and every session recorded under the time model go away.
-- Sessions that never recorded stamina can no longer be rated against anything,
-- and leaving them would keep inflating lifetime gold with runs the dashboard
-- can't explain.
--
-- DESTRUCTIVE: this deletes rows. Sessions logged with stamina are kept.
-- `session_drops.session_id` is ON DELETE CASCADE, so their drops go with them.

begin;

delete from sessions
where stamina_used is null or stamina_used = 0;

alter table sessions
  drop column if exists duration_minutes;

commit;
