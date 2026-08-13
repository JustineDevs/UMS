-- CRM integration mapping ledger for Nango-backed customer sync.
-- Medusa remains the system of record for customer identity; this table captures
-- the mapping metadata needed by staff to understand sync health, operator intent,
-- and external connection lineage.

create table if not exists public.crm_nango_mappings (
  id uuid primary key default gen_random_uuid(),
  customer_email text not null,
  medusa_customer_id text,
  nango_provider text not null default 'nango',
  nango_connection_id text,
  nango_external_contact_id text,
  nango_external_account_id text,
  sync_state text not null default 'pending'
    check (sync_state in ('pending', 'synced', 'partial', 'failed', 'manual_only', 'disabled', 'stale')),
  sync_mode text not null default 'automatic'
    check (sync_mode in ('automatic', 'manual', 'disabled')),
  capabilities jsonb not null default '{}'::jsonb check (jsonb_typeof(capabilities) = 'object'),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  last_error_code text,
  last_error text,
  last_failed_step text,
  last_synced_at timestamptz,
  last_webhook_event_id text,
  last_webhook_status text,
  correlation_id text,
  idempotency_key text,
  created_by_email text,
  updated_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (customer_email, nango_provider, nango_connection_id)
);

create index if not exists idx_crm_nango_mappings_customer_email
  on public.crm_nango_mappings(customer_email, nango_provider, sync_state, updated_at desc);

create index if not exists idx_crm_nango_mappings_medusa_customer
  on public.crm_nango_mappings(medusa_customer_id, nango_provider, sync_state, updated_at desc)
  where medusa_customer_id is not null;

create index if not exists idx_crm_nango_mappings_external_contact
  on public.crm_nango_mappings(nango_external_contact_id)
  where nango_external_contact_id is not null;

alter table public.crm_nango_mappings enable row level security;

drop policy if exists crm_nango_mappings_deny_anon on public.crm_nango_mappings;
create policy crm_nango_mappings_deny_anon
  on public.crm_nango_mappings
  for all
  to anon
  using (false)
  with check (false);

drop policy if exists crm_nango_mappings_deny_authenticated on public.crm_nango_mappings;
create policy crm_nango_mappings_deny_authenticated
  on public.crm_nango_mappings
  for all
  to authenticated
  using (false)
  with check (false);

drop policy if exists crm_nango_mappings_service_all on public.crm_nango_mappings;
create policy crm_nango_mappings_service_all
  on public.crm_nango_mappings
  for all
  to service_role
  using (true)
  with check (true);

create or replace function public.set_crm_nango_mappings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists crm_nango_mappings_updated_at on public.crm_nango_mappings;
create trigger crm_nango_mappings_updated_at
  before update on public.crm_nango_mappings
  for each row
  execute function public.set_crm_nango_mappings_updated_at();
