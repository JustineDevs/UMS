-- Delivery logistics ledger for shipment, dispatch, proof-of-delivery, and settlement records.
-- Orders remain the source of truth for commerce; this ledger stores the operational mirror
-- that logistics staff can act on without overloading the admin UI with planning detail.

create table if not exists public.delivery_logistics_shipments (
  id uuid primary key default gen_random_uuid(),
  order_id text not null unique,
  order_display_id text,
  customer_email text not null,
  branch_id text,
  courier_slug text,
  courier_label text,
  status text not null default 'planned'
    check (status in ('planned', 'assigned', 'in_transit', 'delivered', 'returned', 'cancelled')),
  origin_address jsonb not null default '{}'::jsonb check (jsonb_typeof(origin_address) = 'object'),
  destination_address jsonb not null default '{}'::jsonb check (jsonb_typeof(destination_address) = 'object'),
  geocoded_destination jsonb not null default '{}'::jsonb check (jsonb_typeof(geocoded_destination) = 'object'),
  sla_code text,
  sla_label text,
  package_dimensions jsonb not null default '{}'::jsonb check (jsonb_typeof(package_dimensions) = 'object'),
  hazard_flags jsonb not null default '[]'::jsonb check (jsonb_typeof(hazard_flags) = 'array'),
  route_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(route_metadata) = 'object'),
  tracking_url text,
  tracking_status text,
  proof_of_delivery jsonb not null default '{}'::jsonb check (jsonb_typeof(proof_of_delivery) = 'object'),
  cod_amount numeric(12, 2),
  driver_cash_balance numeric(12, 2),
  settlement_status text not null default 'pending'
    check (settlement_status in ('pending', 'held', 'reconciled', 'remitted', 'none')),
  pricing jsonb not null default '{}'::jsonb check (jsonb_typeof(pricing) = 'object'),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  last_event_at timestamptz,
  created_by_email text,
  updated_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_delivery_logistics_shipments_status
  on public.delivery_logistics_shipments(status, updated_at desc);

create index if not exists idx_delivery_logistics_shipments_customer
  on public.delivery_logistics_shipments(customer_email, status, updated_at desc);

create index if not exists idx_delivery_logistics_shipments_courier
  on public.delivery_logistics_shipments(courier_slug, status, updated_at desc)
  where courier_slug is not null;

alter table public.delivery_logistics_shipments enable row level security;

drop policy if exists delivery_logistics_shipments_deny_anon on public.delivery_logistics_shipments;
create policy delivery_logistics_shipments_deny_anon
  on public.delivery_logistics_shipments
  for all
  to anon
  using (false)
  with check (false);

drop policy if exists delivery_logistics_shipments_deny_authenticated on public.delivery_logistics_shipments;
create policy delivery_logistics_shipments_deny_authenticated
  on public.delivery_logistics_shipments
  for all
  to authenticated
  using (false)
  with check (false);

drop policy if exists delivery_logistics_shipments_service_all on public.delivery_logistics_shipments;
create policy delivery_logistics_shipments_service_all
  on public.delivery_logistics_shipments
  for all
  to service_role
  using (true)
  with check (true);

create or replace function public.set_delivery_logistics_shipments_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists delivery_logistics_shipments_updated_at on public.delivery_logistics_shipments;
create trigger delivery_logistics_shipments_updated_at
  before update on public.delivery_logistics_shipments
  for each row
  execute function public.set_delivery_logistics_shipments_updated_at();

create table if not exists public.delivery_logistics_events (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.delivery_logistics_shipments(id) on delete cascade,
  event_type text not null,
  event_status text,
  event_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(event_payload) = 'object'),
  occurred_at timestamptz not null default now(),
  created_by_email text,
  created_at timestamptz not null default now()
);

create index if not exists idx_delivery_logistics_events_shipment
  on public.delivery_logistics_events(shipment_id, occurred_at desc);

create index if not exists idx_delivery_logistics_events_type
  on public.delivery_logistics_events(event_type, occurred_at desc);

alter table public.delivery_logistics_events enable row level security;

drop policy if exists delivery_logistics_events_deny_anon on public.delivery_logistics_events;
create policy delivery_logistics_events_deny_anon
  on public.delivery_logistics_events
  for all
  to anon
  using (false)
  with check (false);

drop policy if exists delivery_logistics_events_deny_authenticated on public.delivery_logistics_events;
create policy delivery_logistics_events_deny_authenticated
  on public.delivery_logistics_events
  for all
  to authenticated
  using (false)
  with check (false);

drop policy if exists delivery_logistics_events_service_all on public.delivery_logistics_events;
create policy delivery_logistics_events_service_all
  on public.delivery_logistics_events
  for all
  to service_role
  using (true)
  with check (true);
