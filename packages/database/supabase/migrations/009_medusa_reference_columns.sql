-- Explicit Medusa foreign-style references on legacy tables (Pattern A).
-- Backfill from existing order_id columns where those values are already Medusa ids.

alter table public.product_reviews
  add column if not exists medusa_product_id text;

create index if not exists idx_product_reviews_medusa_product_id
  on public.product_reviews(medusa_product_id)
  where medusa_product_id is not null and length(trim(medusa_product_id)) > 0;

comment on column public.product_reviews.product_slug is
  'Storefront handle; denormalized for legacy rows. Canonical product identity is medusa_product_id when set.';
comment on column public.product_reviews.medusa_product_id is
  'Medusa product id (pk in Medusa DB). Required for new review inserts.';

alter table public.loyalty_transactions
  add column if not exists medusa_order_id text;

update public.loyalty_transactions
set medusa_order_id = nullif(trim(order_id), '')
where medusa_order_id is null
  and order_id is not null
  and length(trim(order_id)) > 0;

comment on column public.loyalty_transactions.order_id is
  'Legacy column: same value as medusa_order_id when the row references a Medusa order.';
comment on column public.loyalty_transactions.medusa_order_id is
  'Medusa order id for this points line; authoritative reference alongside order_id.';

create index if not exists idx_loyalty_tx_medusa_order
  on public.loyalty_transactions(medusa_order_id)
  where medusa_order_id is not null;

alter table public.digital_receipts
  add column if not exists medusa_order_id text;

update public.digital_receipts
set medusa_order_id = nullif(trim(order_id), '')
where medusa_order_id is null
  and order_id is not null;

comment on column public.digital_receipts.order_id is
  'Medusa order id (historical column name).';
comment on column public.digital_receipts.medusa_order_id is
  'Explicit Medusa order id mirror for queries and joins.';

create index if not exists idx_digital_receipts_medusa_order
  on public.digital_receipts(medusa_order_id)
  where medusa_order_id is not null;

alter table public.pos_voids
  add column if not exists medusa_order_id text;

update public.pos_voids
set medusa_order_id = nullif(trim(order_id), '')
where medusa_order_id is null
  and order_id is not null;

comment on column public.pos_voids.order_id is
  'POS order reference; when Medusa-backed, matches medusa_order_id.';
comment on column public.pos_voids.medusa_order_id is
  'Medusa order id when the void targets a Medusa sale.';
