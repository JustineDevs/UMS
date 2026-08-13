-- Nango owns encrypted provider credentials. This table stores only the
-- connection reference and the merchant identity that owns it.
create table if not exists public.payment_nango_connections (
  id uuid primary key default gen_random_uuid(),
  provider_config_key text not null,
  nango_connection_id text not null,
  merchant_identity text not null,
  organization_id text not null,
  provider text,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_config_key, merchant_identity),
  unique (provider_config_key, nango_connection_id)
);

create index if not exists idx_payment_nango_connections_owner
  on public.payment_nango_connections(organization_id, active, updated_at desc);

alter table public.payment_nango_connections enable row level security;
drop policy if exists payment_nango_connections_deny_anon on public.payment_nango_connections;
create policy payment_nango_connections_deny_anon on public.payment_nango_connections for all to anon using (false) with check (false);
drop policy if exists payment_nango_connections_deny_authenticated on public.payment_nango_connections;
create policy payment_nango_connections_deny_authenticated on public.payment_nango_connections for all to authenticated using (false) with check (false);
drop policy if exists payment_nango_connections_service_all on public.payment_nango_connections;
create policy payment_nango_connections_service_all on public.payment_nango_connections for all to service_role using (true) with check (true);
