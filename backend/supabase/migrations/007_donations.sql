-- Donations paid through Omise (PromptPay / TrueMoney Wallet).
-- Real money (THB), stored in the smallest unit: SATANG (฿1 = 100 satang).
-- This is unrelated to the in-game gold/copper currency.
--
-- Payment is verified server-side against Omise (webhook + poll), so `status`
-- only becomes 'successful' when Omise confirms it — a client cannot fake it.
create table if not exists donations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  display_name text not null,
  message text,
  amount bigint not null,                         -- satang
  currency text not null default 'THB',
  channel text not null,                          -- 'promptpay' | 'truemoney'
  omise_charge_id text,                           -- chrg_... (set after charge is created)
  status text not null default 'pending',         -- 'pending' | 'successful' | 'failed' | 'expired'
  created_at timestamptz default now(),
  paid_at timestamptz
);

-- Webhook looks donations up by the Omise charge id.
create index if not exists donations_omise_charge_id_idx on donations (omise_charge_id);
-- User's own history.
create index if not exists donations_user_id_idx on donations (user_id);
-- Thank-you wall: most recent successful donations.
create index if not exists donations_wall_idx on donations (status, paid_at desc);
