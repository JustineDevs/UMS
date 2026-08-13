-- Durable operational records for the CRM and delivery workflows.
-- The commerce and customer tables remain system-of-record; these tables hold
-- assignments, activity, evidence, and computed operational state.

create table if not exists public.crm_activities (
  id uuid primary key default gen_random_uuid(),
  customer_email text not null,
  activity_type text not null check (activity_type in ('email', 'call', 'meeting', 'note', 'task')),
  subject text not null,
  body text,
  owner_email text not null,
  occurred_at timestamptz not null default now(),
  due_at timestamptz,
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_crm_activities_customer on public.crm_activities(customer_email, occurred_at desc);
create index if not exists idx_crm_activities_owner on public.crm_activities(owner_email, completed_at, due_at);

create table if not exists public.crm_pipeline_deals (
  id uuid primary key default gen_random_uuid(),
  customer_email text not null,
  title text not null,
  stage text not null default 'qualified',
  value numeric(12,2) not null default 0 check (value >= 0),
  probability numeric(5,4) not null default 0.25 check (probability >= 0 and probability <= 1),
  owner_email text,
  expected_close_at timestamptz,
  source text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_crm_pipeline_deals_stage on public.crm_pipeline_deals(stage, expected_close_at);
create index if not exists idx_crm_pipeline_deals_owner on public.crm_pipeline_deals(owner_email, stage);

create table if not exists public.crm_goals (
  id uuid primary key default gen_random_uuid(),
  owner_email text not null,
  period_start date not null,
  period_end date not null,
  target_value numeric(12,2) not null check (target_value >= 0),
  target_deals integer not null default 0 check (target_deals >= 0),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_email, period_start, period_end),
  check (period_end >= period_start)
);

create table if not exists public.crm_attachments (
  id uuid primary key default gen_random_uuid(),
  customer_email text not null,
  activity_id uuid references public.crm_activities(id) on delete set null,
  storage_path text not null,
  file_name text not null,
  content_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  uploaded_by_email text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.delivery_logistics_couriers (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label text not null,
  phone text,
  status text not null default 'available' check (status in ('available', 'assigned', 'offline', 'suspended')),
  latitude numeric(9,6),
  longitude numeric(9,6),
  rating numeric(3,2) not null default 0 check (rating >= 0 and rating <= 5),
  max_weight_kg numeric(10,3) not null default 0 check (max_weight_kg >= 0),
  max_volume_cm3 numeric(14,2) not null default 0 check (max_volume_cm3 >= 0),
  cash_balance numeric(12,2) not null default 0 check (cash_balance >= 0),
  cash_limit numeric(12,2) not null default 10000 check (cash_limit >= 0),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.delivery_logistics_telemetry (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.delivery_logistics_shipments(id) on delete cascade,
  courier_id uuid references public.delivery_logistics_couriers(id) on delete set null,
  latitude numeric(9,6) not null check (latitude between -90 and 90),
  longitude numeric(9,6) not null check (longitude between -180 and 180),
  speed_kph numeric(8,2) check (speed_kph >= 0),
  heading numeric(6,2) check (heading >= 0 and heading < 360),
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_delivery_telemetry_shipment on public.delivery_logistics_telemetry(shipment_id, captured_at desc);

create table if not exists public.delivery_logistics_proofs (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.delivery_logistics_shipments(id) on delete cascade,
  method text not null check (method in ('signature', 'photo', 'otp', 'contactless')),
  recipient_name text,
  photo_url text,
  signature text,
  contact_log text,
  otp_digest text,
  latitude numeric(9,6),
  longitude numeric(9,6),
  verified boolean not null default false,
  verified_at timestamptz,
  created_by_email text,
  created_at timestamptz not null default now()
);

create table if not exists public.delivery_logistics_settlements (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.delivery_logistics_shipments(id) on delete cascade,
  courier_id uuid references public.delivery_logistics_couriers(id) on delete set null,
  delivery_fee numeric(12,2) not null default 0 check (delivery_fee >= 0),
  driver_earnings numeric(12,2) not null default 0 check (driver_earnings >= 0),
  tolls numeric(12,2) not null default 0 check (tolls >= 0),
  tip numeric(12,2) not null default 0 check (tip >= 0),
  cod_collected numeric(12,2) not null default 0 check (cod_collected >= 0),
  remitted_at timestamptz,
  remitted_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shipment_id)
);

create table if not exists public.delivery_logistics_exceptions (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.delivery_logistics_shipments(id) on delete cascade,
  exception_type text not null check (exception_type in ('accident', 'customer_absent', 'wrong_address', 'vehicle_breakdown', 'weather', 'other')),
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  details text not null,
  resolved_at timestamptz,
  resolved_by_email text,
  created_by_email text,
  created_at timestamptz not null default now()
);

alter table public.crm_activities enable row level security;
alter table public.crm_pipeline_deals enable row level security;
alter table public.crm_goals enable row level security;
alter table public.crm_attachments enable row level security;
alter table public.delivery_logistics_couriers enable row level security;
alter table public.delivery_logistics_telemetry enable row level security;
alter table public.delivery_logistics_proofs enable row level security;
alter table public.delivery_logistics_settlements enable row level security;
alter table public.delivery_logistics_exceptions enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['crm_activities','crm_pipeline_deals','crm_goals','crm_attachments','delivery_logistics_couriers','delivery_logistics_telemetry','delivery_logistics_proofs','delivery_logistics_settlements','delivery_logistics_exceptions'] loop
    execute format('drop policy if exists %I_deny_anon on public.%I', table_name, table_name);
    execute format('create policy %I_deny_anon on public.%I for all to anon using (false) with check (false)', table_name, table_name);
    execute format('drop policy if exists %I_deny_authenticated on public.%I', table_name, table_name);
    execute format('create policy %I_deny_authenticated on public.%I for all to authenticated using (false) with check (false)', table_name, table_name);
    execute format('drop policy if exists %I_service_all on public.%I', table_name, table_name);
    execute format('create policy %I_service_all on public.%I for all to service_role using (true) with check (true)', table_name, table_name);
  end loop;
end $$;
