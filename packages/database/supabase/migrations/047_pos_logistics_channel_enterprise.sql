-- Enterprise operational controls. Medusa remains commerce source of truth.
create table if not exists public.pos_fiscal_profiles (
  id uuid primary key default gen_random_uuid(), jurisdiction text not null, registration_number text not null,
  invoice_prefix text not null, enabled boolean not null default false, created_at timestamptz not null default now(),
  unique (jurisdiction, registration_number)
);
create table if not exists public.pos_terminal_certifications (
  id uuid primary key default gen_random_uuid(), provider text not null, model text not null, firmware text not null,
  certification_id text not null unique, expires_at timestamptz, active boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.pos_payment_terminals (
  id uuid primary key default gen_random_uuid(), device_id uuid references public.pos_devices(id) on delete set null,
  provider text not null, model text not null, serial_number text not null unique, status text not null default 'pending'
    check (status in ('pending','certified','degraded','disabled')), certification_id text, last_health_at timestamptz,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'), created_at timestamptz not null default now()
);
create table if not exists public.pos_shift_reconciliations (
  id uuid primary key default gen_random_uuid(), shift_id uuid not null unique references public.pos_shifts(id) on delete cascade,
  opening_cash numeric(12,2) not null check (opening_cash >= 0), cash_sales numeric(12,2) not null check (cash_sales >= 0),
  cash_refunds numeric(12,2) not null default 0 check (cash_refunds >= 0), payouts numeric(12,2) not null default 0 check (payouts >= 0),
  expected_cash numeric(12,2) not null, counted_cash numeric(12,2) not null check (counted_cash >= 0), variance numeric(12,2) not null,
  created_by_email text not null, created_at timestamptz not null default now()
);
alter table public.pos_shift_reconciliations add column if not exists idempotency_key text;
create unique index if not exists pos_shift_reconciliation_idempotency on public.pos_shift_reconciliations(idempotency_key) where idempotency_key is not null;
alter table public.delivery_logistics_shipments add column if not exists tenant_key text not null default 'default';
alter table public.delivery_logistics_couriers add column if not exists tenant_key text not null default 'default';
alter table public.delivery_logistics_couriers drop constraint if exists delivery_logistics_couriers_slug_key;
create unique index if not exists delivery_courier_tenant_slug on public.delivery_logistics_couriers(tenant_key, slug);
alter table public.delivery_logistics_telemetry add column if not exists tenant_key text not null default 'default';
alter table public.delivery_logistics_proofs add column if not exists tenant_key text not null default 'default';
alter table public.delivery_logistics_settlements add column if not exists tenant_key text not null default 'default';
alter table public.delivery_logistics_exceptions add column if not exists tenant_key text not null default 'default';
alter table public.delivery_logistics_settlements drop constraint if exists delivery_logistics_settlements_shipment_id_key;
create unique index if not exists delivery_settlement_tenant_shipment on public.delivery_logistics_settlements(tenant_key, shipment_id);
alter table public.delivery_logistics_telemetry add column if not exists idempotency_key text;
drop index if exists public.delivery_telemetry_idempotency;
create unique index if not exists delivery_telemetry_idempotency on public.delivery_logistics_telemetry(tenant_key, shipment_id, idempotency_key) where idempotency_key is not null;
create table if not exists public.delivery_courier_cash_ledger (
  id uuid primary key default gen_random_uuid(), tenant_key text not null default 'default', courier_id uuid not null references public.delivery_logistics_couriers(id),
  shipment_id uuid references public.delivery_logistics_shipments(id), amount numeric(12,2) not null check (amount >= 0),
  direction text not null check (direction in ('collect','remit','adjust')), idempotency_key text not null, created_by_email text not null, created_at timestamptz not null default now(),
  unique (tenant_key, courier_id, idempotency_key)
);
create table if not exists public.delivery_driver_earnings (
  id uuid primary key default gen_random_uuid(), tenant_key text not null default 'default', courier_id uuid not null references public.delivery_logistics_couriers(id),
  shipment_id uuid references public.delivery_logistics_shipments(id), delivery_fee numeric(12,2) not null check (delivery_fee >= 0), tip numeric(12,2) not null default 0,
  tolls numeric(12,2) not null default 0, commission_rate numeric(5,4) not null default 0 check (commission_rate between 0 and 1), net_earnings numeric(12,2) not null,
  status text not null default 'pending' check (status in ('pending','approved','paid')), created_at timestamptz not null default now(), unique (tenant_key, courier_id, shipment_id)
);
alter table public.channel_sync_events add column if not exists tenant_key text not null default 'default';
alter table public.channel_sync_events add column if not exists payload_hash text;
create unique index if not exists channel_event_payload_replay on public.channel_sync_events(tenant_key, channel, payload_hash) where payload_hash is not null;

alter table public.pos_fiscal_profiles enable row level security;
alter table public.pos_terminal_certifications enable row level security;
alter table public.pos_payment_terminals enable row level security;
alter table public.pos_shift_reconciliations enable row level security;
alter table public.delivery_courier_cash_ledger enable row level security;
alter table public.delivery_driver_earnings enable row level security;
alter table public.delivery_logistics_proofs enable row level security;
alter table public.delivery_logistics_settlements enable row level security;
alter table public.delivery_logistics_exceptions enable row level security;
do $$ declare t text; begin
  foreach t in array array['pos_fiscal_profiles','pos_terminal_certifications','pos_payment_terminals','pos_shift_reconciliations','delivery_courier_cash_ledger','delivery_driver_earnings','delivery_logistics_proofs','delivery_logistics_settlements','delivery_logistics_exceptions'] loop
    execute format('drop policy if exists service_role_only on public.%I', t);
    execute format('create policy service_role_only on public.%I for all to service_role using (true) with check (true)', t);
  end loop;
end $$;
