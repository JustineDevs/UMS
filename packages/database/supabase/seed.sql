-- Seed schema for Supabase platform data (idempotent)
-- Run with: pnpm db:seed
--
-- Target schema (ADR-0002): Identity, RBAC, compliance, audit only.
-- Medusa owns commerce. No products, orders, payments, inventory, shipments here.

create extension if not exists "pgcrypto";

do $$ begin create type public.user_role as enum ('admin', 'staff', 'customer'); exception when duplicate_object then null; end $$;
do $$ begin create type public.compliance_request_type as enum ('dsar_export', 'anonymization', 'retention'); exception when duplicate_object then null; end $$;
do $$ begin create type public.compliance_request_status as enum ('pending', 'in_progress', 'completed', 'failed'); exception when duplicate_object then null; end $$;
do $$ begin create type public.retention_job_status as enum ('pending', 'running', 'completed', 'failed'); exception when duplicate_object then null; end $$;

-- === IDENTITY / RBAC ===
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text,
  image text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  role public.user_role not null,
  created_at timestamptz not null default now(),
  unique(user_id)
);

create table if not exists public.staff_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade unique,
  metadata jsonb default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.oauth_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  provider text not null,
  provider_account_id text not null,
  created_at timestamptz not null default now(),
  unique(provider, provider_account_id)
);

-- === COMPLIANCE ===
create table if not exists public.compliance_requests (
  id uuid primary key default gen_random_uuid(),
  type public.compliance_request_type not null,
  requestor_email text not null,
  status public.compliance_request_status not null default 'pending',
  metadata jsonb default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.compliance_exports (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.compliance_requests(id) on delete set null,
  status text not null default 'pending',
  export_metadata jsonb default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.retention_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,
  status public.retention_job_status not null default 'pending',
  run_at timestamptz,
  metadata jsonb default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- === AUDIT / PLATFORM ===
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  actor_id uuid references public.users(id) on delete set null,
  resource text,
  details jsonb default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.legacy_import_runs (
  id uuid primary key default gen_random_uuid(),
  import_type text not null,
  status text not null default 'pending',
  run_at timestamptz,
  metadata jsonb default '{}',
  created_at timestamptz not null default now()
);

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
  unique(kind, code)
);

create index if not exists idx_user_roles_user_id on public.user_roles(user_id);
create index if not exists idx_oauth_accounts_user_id on public.oauth_accounts(user_id);
create index if not exists idx_oauth_accounts_provider on public.oauth_accounts(provider, provider_account_id);
create index if not exists idx_compliance_requests_status on public.compliance_requests(status);
create index if not exists idx_compliance_requests_requestor on public.compliance_requests(requestor_email);
create index if not exists idx_compliance_exports_request_id on public.compliance_exports(request_id);
create index if not exists idx_retention_jobs_status on public.retention_jobs(status);
create index if not exists idx_audit_logs_actor on public.audit_logs(actor_id);
create index if not exists idx_audit_logs_created on public.audit_logs(created_at);
create index if not exists idx_return_refund_reasons_kind_order
  on public.return_refund_reasons(kind, is_active, sort_order, label);
create index if not exists idx_return_refund_reasons_kind_label
  on public.return_refund_reasons(kind, label);

-- Row Level Security
alter table public.users enable row level security;
alter table public.user_roles enable row level security;
alter table public.staff_profiles enable row level security;
alter table public.oauth_accounts enable row level security;
alter table public.compliance_requests enable row level security;
alter table public.compliance_exports enable row level security;
alter table public.retention_jobs enable row level security;
alter table public.audit_logs enable row level security;
alter table public.legacy_import_runs enable row level security;
alter table public.return_refund_reasons enable row level security;

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
