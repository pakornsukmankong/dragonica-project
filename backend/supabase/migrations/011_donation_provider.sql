-- Record which payment gateway created each donation, so rows can be
-- reconciled per-provider when switching between Omise and Beam.
-- The existing `omise_charge_id` column now holds whichever provider's charge
-- id created the donation (kept for backward compatibility).
alter table donations
  add column if not exists provider text not null default 'omise';
