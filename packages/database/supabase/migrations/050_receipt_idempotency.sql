-- A Medusa order has one canonical digital receipt. Keep the first record if legacy duplicates exist.
with ranked as (
  select id, row_number() over (partition by medusa_order_id order by created_at asc, id asc) as row_number
  from public.digital_receipts
  where medusa_order_id is not null
)
delete from public.digital_receipts
where id in (select id from ranked where row_number > 1);

create unique index if not exists digital_receipts_medusa_order_unique
  on public.digital_receipts(medusa_order_id)
  where medusa_order_id is not null;
