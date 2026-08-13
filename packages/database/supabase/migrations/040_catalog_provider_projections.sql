-- Provider projection ledger for catalog publishing.
-- Medusa owns the canonical product; this table tracks provider-specific mirrors,
-- checkout-only references, and sync state for the admin UI.

create table if not exists public.catalog_provider_projections (
  id uuid primary key default gen_random_uuid(),
  medusa_product_id text not null,
  provider text not null,
  artifact_type text not null,
  external_id text,
  external_url text,
  sync_state text not null default 'pending'
    check (sync_state in ('pending', 'synced', 'partial', 'failed', 'manual_only', 'disabled', 'stale')),
  sync_mode text not null default 'automatic'
    check (sync_mode in ('automatic', 'manual', 'disabled')),
  region_code text,
  channel_code text,
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
  unique (medusa_product_id, provider, artifact_type)
);

create index if not exists idx_catalog_provider_projections_product
  on public.catalog_provider_projections(medusa_product_id, provider, artifact_type);

create index if not exists idx_catalog_provider_projections_state
  on public.catalog_provider_projections(provider, sync_state, sync_mode, updated_at desc);

create index if not exists idx_catalog_provider_projections_external
  on public.catalog_provider_projections(provider, external_id)
  where external_id is not null;

alter table public.catalog_provider_projections enable row level security;

drop policy if exists catalog_provider_projections_deny_anon on public.catalog_provider_projections;
create policy catalog_provider_projections_deny_anon
  on public.catalog_provider_projections
  for all
  to anon
  using (false)
  with check (false);

drop policy if exists catalog_provider_projections_deny_authenticated on public.catalog_provider_projections;
create policy catalog_provider_projections_deny_authenticated
  on public.catalog_provider_projections
  for all
  to authenticated
  using (false)
  with check (false);

drop policy if exists catalog_provider_projections_service_all on public.catalog_provider_projections;
create policy catalog_provider_projections_service_all
  on public.catalog_provider_projections
  for all
  to service_role
  using (true)
  with check (true);

create or replace function public.set_catalog_provider_projections_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists catalog_provider_projections_updated_at on public.catalog_provider_projections;
create trigger catalog_provider_projections_updated_at
  before update on public.catalog_provider_projections
  for each row
  execute function public.set_catalog_provider_projections_updated_at();
