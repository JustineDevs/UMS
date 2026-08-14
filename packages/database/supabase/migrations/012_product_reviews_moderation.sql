-- Product reviews: moderation, customer linkage, verified purchase metadata.
-- Public anon reads only approved rows. Inserts remain server-side (service role).
--
-- Column order: add every column referenced by UPDATE before any UPDATE.

alter table public.product_reviews
  add column if not exists status text not null default 'pending';

alter table public.product_reviews
  add column if not exists medusa_customer_id text;

alter table public.product_reviews
  add column if not exists customer_email text;

alter table public.product_reviews
  add column if not exists is_verified_buyer boolean not null default false;

alter table public.product_reviews
  add column if not exists verified_medusa_order_id text;

alter table public.product_reviews
  add column if not exists verified_at timestamptz;

alter table public.product_reviews
  add column if not exists moderated_by_staff_email text;

alter table public.product_reviews
  add column if not exists moderated_at timestamptz;

alter table public.product_reviews
  add column if not exists moderation_note text;

-- Existing rows get default status 'pending'. Approve legacy public reviews in admin if needed.
alter table public.product_reviews
  alter column status set default 'pending';

alter table public.product_reviews
  drop constraint if exists product_reviews_status_check;

alter table public.product_reviews
  add constraint product_reviews_status_check
  check (status in ('pending', 'approved', 'rejected', 'hidden'));

create index if not exists idx_product_reviews_status_created
  on public.product_reviews(status, created_at desc);

create index if not exists idx_product_reviews_customer_product
  on public.product_reviews(medusa_customer_id, medusa_product_id)
  where medusa_customer_id is not null;

-- One active review per customer + product (rejected rows do not block a new submission).
create unique index if not exists idx_product_reviews_one_active_per_customer_product
  on public.product_reviews(medusa_customer_id, medusa_product_id)
  where medusa_customer_id is not null
    and status in ('pending', 'approved', 'hidden');

drop policy if exists "product_reviews_select_public" on public.product_reviews;
create policy "product_reviews_select_public"
  on public.product_reviews for select
  to anon, authenticated
  using (status = 'approved');

comment on column public.product_reviews.status is
  'pending: awaiting staff; approved: visible on storefront; rejected: not public; hidden: soft-unpublish.';
comment on column public.product_reviews.is_verified_buyer is
  'True when Medusa order history proves a completed purchase of this product for medusa_customer_id.';
comment on column public.product_reviews.verified_medusa_order_id is
  'Medusa order id used as evidence for verified purchase.';
