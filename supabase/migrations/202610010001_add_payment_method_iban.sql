-- Keep existing account numbers and payment methods intact.
-- IBAN is optional so bank transfers and mobile wallets remain compatible.
alter table public.payment_methods
  add column if not exists iban_number text;
