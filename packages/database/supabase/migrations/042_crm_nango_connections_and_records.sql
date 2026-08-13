-- CRM integration bridge for Nango-backed CRM auth plus synced contact/deal records.
-- `crm_nango_mappings` keeps customer-centric mapping state.
-- `crm_nango_connections` captures the global enterprise connection and attribution.
-- `crm_nango_records` tracks the actual contact/deal rows moving between systems.

create table if not exists public.crm_nango_connections (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'nango',
  provider_config_key text not null,
  connection_id text not null,
  connection_name text,
  organization_id text,
  branch_id text,
  staff_user_id text,
  staff_email text,
  sync_scope text not null default 'global'
    check (sync_scope in ('global', 'organization', 'branch', 'customer')),
  active boolean not null default true,
  tags jsonb not null default '{}'::jsonb check (jsonb_typeof(tags) = 'object'),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  last_authorized_at timestamptz,
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_config_key, connection_id)
);

create index if not exists idx_crm_nango_connections_provider
  on public.crm_nango_connections(provider, provider_config_key, active, updated_at desc);

create index if not exists idx_crm_nango_connections_connection_id
  on public.crm_nango_connections(connection_id, provider_config_key)
  where connection_id is not null;

create table if not exists public.crm_nango_records (
  id uuid primary key default gen_random_uuid(),
  connection_row_id uuid not null references public.crm_nango_connections(id) on delete cascade,
  provider text not null default 'nango',
  provider_config_key text not null,
  connection_id text not null,
  local_entity_type text not null check (local_entity_type in ('contact', 'deal')),
  local_record_id text not null,
  local_record_label text,
  external_entity_type text not null check (external_entity_type in ('contact', 'deal')),
  external_record_id text,
  external_account_id text,
  sync_state text not null default 'pending'
    check (sync_state in ('pending', 'synced', 'partial', 'failed', 'manual_only', 'disabled', 'stale')),
  sync_mode text not null default 'automatic'
    check (sync_mode in ('automatic', 'manual', 'disabled')),
  sync_scope text not null default 'global'
    check (sync_scope in ('global', 'organization', 'branch', 'customer')),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  tags jsonb not null default '{}'::jsonb check (jsonb_typeof(tags) = 'object'),
  last_error_code text,
  last_error text,
  last_failed_step text,
  last_synced_at timestamptz,
  last_synced_by_email text,
  last_direction text check (last_direction in ('to_crm', 'from_crm', 'bidirectional')),
  correlation_id text,
  created_by_email text,
  updated_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_crm_nango_records_connection
  on public.crm_nango_records(connection_row_id, local_entity_type, sync_state, updated_at desc);

create index if not exists idx_crm_nango_records_external
  on public.crm_nango_records(external_record_id, external_entity_type)
  where external_record_id is not null;

create index if not exists idx_crm_nango_records_local
  on public.crm_nango_records(local_entity_type, local_record_id, sync_state, updated_at desc);

create unique index if not exists idx_crm_nango_records_unique
  on public.crm_nango_records (
    provider,
    provider_config_key,
    connection_id,
    local_entity_type,
    local_record_id,
    external_entity_type,
    coalesce(external_record_id, '')
  );

alter table public.crm_nango_connections enable row level security;
alter table public.crm_nango_records enable row level security;

drop policy if exists crm_nango_connections_deny_anon on public.crm_nango_connections;
create policy crm_nango_connections_deny_anon
  on public.crm_nango_connections
  for all
  to anon
  using (false)
  with check (false);

drop policy if exists crm_nango_connections_deny_authenticated on public.crm_nango_connections;
create policy crm_nango_connections_deny_authenticated
  on public.crm_nango_connections
  for all
  to authenticated
  using (false)
  with check (false);

drop policy if exists crm_nango_connections_service_all on public.crm_nango_connections;
create policy crm_nango_connections_service_all
  on public.crm_nango_connections
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists crm_nango_records_deny_anon on public.crm_nango_records;
create policy crm_nango_records_deny_anon
  on public.crm_nango_records
  for all
  to anon
  using (false)
  with check (false);

drop policy if exists crm_nango_records_deny_authenticated on public.crm_nango_records;
create policy crm_nango_records_deny_authenticated
  on public.crm_nango_records
  for all
  to authenticated
  using (false)
  with check (false);

drop policy if exists crm_nango_records_service_all on public.crm_nango_records;
create policy crm_nango_records_service_all
  on public.crm_nango_records
  for all
  to service_role
  using (true)
  with check (true);

create or replace function public.set_crm_nango_connections_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists crm_nango_connections_updated_at on public.crm_nango_connections;
create trigger crm_nango_connections_updated_at
  before update on public.crm_nango_connections
  for each row
  execute function public.set_crm_nango_connections_updated_at();

create or replace function public.set_crm_nango_records_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists crm_nango_records_updated_at on public.crm_nango_records;
create trigger crm_nango_records_updated_at
  before update on public.crm_nango_records
  for each row
  execute function public.set_crm_nango_records_updated_at();
