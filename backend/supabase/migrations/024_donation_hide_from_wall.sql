-- Let an admin keep an entire donation off the public thank-you wall (name,
-- message, and amount all withheld) without deleting the ledger record.
-- Complements 012's hide_amount, which only masks the amount.
alter table donations
  add column if not exists hide_from_wall boolean not null default false;
