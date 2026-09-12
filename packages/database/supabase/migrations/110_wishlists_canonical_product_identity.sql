-- Keep one wishlist row per customer and canonical Medusa product.
-- Legacy rows may have a null product id; new API writes fail closed without one.
with duplicates as (
  select id,
         row_number() over (
           partition by medusa_customer_id, medusa_product_id
           order by added_at desc, id desc
         ) as row_number
  from public.wishlists
  where medusa_product_id is not null
)
delete from public.wishlists w
using duplicates d
where w.id = d.id
  and d.row_number > 1;

create unique index if not exists wishlists_customer_medusa_product_unique
  on public.wishlists (medusa_customer_id, medusa_product_id)
  where medusa_product_id is not null;
