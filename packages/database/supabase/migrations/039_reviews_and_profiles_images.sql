-- Add nullable image fields so staff can seed proof photos on reviews and customer profiles.
-- This keeps the legacy Supabase bridge flexible without changing Medusa commerce ownership.

alter table public.product_reviews
  add column if not exists image_url text;

create index if not exists idx_product_reviews_status_created
  on public.product_reviews(status, created_at desc);

alter table public.storefront_customer_profiles
  add column if not exists avatar_url text;

create index if not exists idx_storefront_customer_profiles_email
  on public.storefront_customer_profiles(email);

