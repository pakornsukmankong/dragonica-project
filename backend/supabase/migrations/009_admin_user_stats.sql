-- Per-user grind aggregates for the admin Users tab, computed in SQL instead
-- of shipping every sessions row to the API and counting in Node (that scan
-- grew with total site activity, unbounded).
create or replace function public.admin_user_stats()
returns table (user_id uuid, session_count bigint, total_gold bigint)
language sql
stable
as $$
  select s.user_id,
         count(*)                            as session_count,
         coalesce(sum(s.gold_earned), 0)     as total_gold
    from sessions s
   group by s.user_id;
$$;

-- Backend-only (service role); the data is admin-facing.
revoke execute on function public.admin_user_stats() from anon, authenticated;
