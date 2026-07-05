-- Let a donor keep their contribution amount off the public thank-you wall.
-- Their name and message still appear; only the amount is withheld. Applies to
-- every payment provider. Admins always see the real amount in the ledger.
alter table donations
  add column if not exists hide_amount boolean not null default false;
