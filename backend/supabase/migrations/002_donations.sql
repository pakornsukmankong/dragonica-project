-- Donations paid through a payment gateway (Omise / Beam / Stripe / manual).
-- Real money (THB), stored in the smallest unit: SATANG (฿1 = 100 satang).
-- This is unrelated to the in-game gold/copper currency.
--
-- CONSOLIDATED (2026-07): equals former migrations 007, 011, 012, 024.
--
-- Payment is verified server-side against the gateway (webhook + poll), so
-- `status` only becomes 'successful' when it confirms — a client cannot fake it.
-- provider: which gateway created the donation, so rows can be reconciled
--   per-provider when switching gateways. `omise_charge_id` holds whichever
--   provider's charge id created the donation (name kept for compatibility).
-- hide_amount: donor keeps the amount off the public thank-you wall (name and
--   message still appear). Admins always see the real amount in the ledger.
-- hide_from_wall: admin keeps the entire donation off the wall (name, message,
--   and amount all withheld) without deleting the ledger record.
create table if not exists donations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  display_name text not null,
  message text,
  amount bigint not null,                         -- satang
  currency text not null default 'THB',
  channel text not null,                          -- 'promptpay' | 'truemoney'
  omise_charge_id text,                           -- charge id (set after charge is created)
  status text not null default 'pending',         -- 'pending' | 'successful' | 'failed' | 'expired'
  created_at timestamptz default now(),
  paid_at timestamptz,
  provider text not null default 'omise',
  hide_amount boolean not null default false,
  hide_from_wall boolean not null default false
);

-- Webhook looks donations up by the charge id.
create index if not exists donations_omise_charge_id_idx on donations (omise_charge_id);
-- User's own history.
create index if not exists donations_user_id_idx on donations (user_id);
-- Thank-you wall: most recent successful donations.
create index if not exists donations_wall_idx on donations (status, paid_at desc);
