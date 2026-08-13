create table if not exists public.return_refund_reasons (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('return', 'refund')),
  code text not null,
  label text not null,
  description text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (kind, code)
);

create index if not exists idx_return_refund_reasons_kind_order
  on public.return_refund_reasons(kind, is_active, sort_order, label);

create index if not exists idx_return_refund_reasons_kind_label
  on public.return_refund_reasons(kind, label);

alter table public.return_refund_reasons enable row level security;

drop policy if exists return_refund_reasons_deny_anon on public.return_refund_reasons;
create policy return_refund_reasons_deny_anon
  on public.return_refund_reasons
  for all
  to anon
  using (false)
  with check (false);

drop policy if exists return_refund_reasons_deny_authenticated on public.return_refund_reasons;
create policy return_refund_reasons_deny_authenticated
  on public.return_refund_reasons
  for all
  to authenticated
  using (false)
  with check (false);

insert into public.return_refund_reasons (kind, code, label, description, sort_order)
values
  ('return', 'defective', 'Defective', 'The item arrived or failed with a defect.', 10),
  ('return', 'wrong_item', 'Wrong Item', 'The customer received the wrong item.', 20),
  ('return', 'damaged_in_transit', 'Damaged in Transit', 'The item was damaged during delivery.', 30),
  ('return', 'not_as_described', 'Not as Described', 'The received item does not match the listing.', 40),
  ('return', 'customer_changed_mind', 'Customer Changed Mind', 'The customer no longer wants the item.', 50),
  ('return', 'other', 'Other', 'Use only when none of the standard reasons fit.', 90),
  ('refund', 'customer_request', 'Customer Request', 'The customer asked for a refund.', 10),
  ('refund', 'duplicate_charge', 'Duplicate Charge', 'The payment was charged more than once.', 20),
  ('refund', 'product_defective', 'Product Defective', 'Refund requested because the product was faulty.', 30),
  ('refund', 'product_not_received', 'Product Not Received', 'The customer did not receive the product.', 40),
  ('refund', 'wrong_item', 'Wrong Item', 'The customer received the wrong item and needs a refund.', 50),
  ('refund', 'shipping_issue', 'Shipping Issue', 'Delivery failed or was materially delayed.', 60),
  ('refund', 'other', 'Other', 'Use only when none of the standard reasons fit.', 90)
on conflict (kind, code) do update set
  label = excluded.label,
  description = excluded.description,
  sort_order = excluded.sort_order,
  updated_at = now();
