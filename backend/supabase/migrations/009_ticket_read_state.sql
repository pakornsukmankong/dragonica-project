-- Unread notification badges for tickets.
-- `last_sender_is_admin` records who wrote the most recent message; the two
-- read timestamps record when each side last viewed the thread. A ticket is
-- "unread" for a side when the other side sent last and they haven't looked
-- since (updated_at > their last_read_at).
alter table tickets
  add column if not exists last_sender_is_admin boolean not null default false;
alter table tickets add column if not exists user_last_read_at timestamptz;
alter table tickets add column if not exists admin_last_read_at timestamptz;
