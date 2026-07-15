-- Allow guest (not-logged-in) donations.
--
-- The Support page and the whole donation flow are now public: anyone can
-- donate without an account. A guest donation has no owning profile, so
-- `donations.user_id` becomes nullable. Logged-in donors are still attributed
-- (user_id set from their JWT); guests store NULL.
--
-- The FK to profiles(id) and `on delete cascade` stay as-is — NULL is exempt
-- from the reference, so nothing else changes. Guest donations survive in the
-- ledger regardless of any profile lifecycle.

alter table donations
  alter column user_id drop not null;
