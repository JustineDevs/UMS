-- Prefer the immutable Medusa customer reference for profile ownership.
-- Existing email-keyed rows remain readable until they are naturally migrated.
alter table public.storefront_customer_profiles
  add column if not exists medusa_customer_id text;

create unique index if not exists storefront_customer_profiles_medusa_customer_uidx
  on public.storefront_customer_profiles (medusa_customer_id)
  where medusa_customer_id is not null;

comment on column public.storefront_customer_profiles.medusa_customer_id is
  'Canonical Medusa customer identity. Email is retained only as a legacy migration key.';
