-- D-27: resource context is server-owned and explicit. Commerce IDs remain
-- opaque here because Medusa owns store/channel/provider records.
create table if not exists public.staff_resource_context_grants (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references public.organizations(id) on delete cascade,
  auth_user_id text not null,
  store_id text,
  channel_id text,
  provider text,
  permission_key text not null default '*',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (btrim(auth_user_id) <> ''),
  check (store_id is null or btrim(store_id) <> ''),
  check (channel_id is null or btrim(channel_id) <> ''),
  check (provider is null or btrim(provider) <> ''),
  check (btrim(permission_key) <> ''),
  unique (organization_id, auth_user_id, store_id, channel_id, provider, permission_key)
);

create index if not exists staff_resource_context_grants_lookup
  on public.staff_resource_context_grants (organization_id, auth_user_id, active);

alter table public.staff_resource_context_grants enable row level security;
drop policy if exists staff_resource_context_grants_deny_anon on public.staff_resource_context_grants;
create policy staff_resource_context_grants_deny_anon on public.staff_resource_context_grants for all to anon using (false) with check (false);
drop policy if exists staff_resource_context_grants_deny_authenticated on public.staff_resource_context_grants;
create policy staff_resource_context_grants_deny_authenticated on public.staff_resource_context_grants for all to authenticated using (false) with check (false);
drop policy if exists staff_resource_context_grants_service_all on public.staff_resource_context_grants;
create policy staff_resource_context_grants_service_all on public.staff_resource_context_grants for all to service_role using (true) with check (true);
