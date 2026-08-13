create table if not exists public.organizations (
  id text primary key,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_memberships (
  organization_id text not null references public.organizations(id) on delete cascade,
  user_email text not null,
  role text not null check (role in ('owner', 'admin', 'manager', 'staff')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_email)
);
create index if not exists organization_memberships_user_idx
  on public.organization_memberships(lower(user_email), active);

insert into public.organizations (id, name)
select distinct organization_id, 'Universal Music Store'
from public.payment_nango_connections
where organization_id is not null and btrim(organization_id) <> ''
on conflict (id) do nothing;

insert into public.organization_memberships (organization_id, user_email, role)
select distinct organization_id, lower(merchant_identity), 'owner'
from public.payment_nango_connections
where organization_id is not null
  and btrim(organization_id) <> ''
  and merchant_identity is not null
  and btrim(merchant_identity) <> ''
on conflict (organization_id, user_email) do nothing;

-- Keep the auth-disabled local QA identity usable without weakening production
-- tenant resolution. These rows are harmless in environments that do not use
-- the local fallback identity.
insert into public.organizations (id, name)
values ('local-admin@example.com', 'Local QA Organization')
on conflict (id) do nothing;
insert into public.organization_memberships (organization_id, user_email, role)
values ('local-admin@example.com', 'local-admin@example.com', 'owner')
on conflict (organization_id, user_email) do nothing;

alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
drop policy if exists organizations_deny_anon on public.organizations;
create policy organizations_deny_anon on public.organizations for all to anon using (false) with check (false);
drop policy if exists organizations_deny_authenticated on public.organizations;
create policy organizations_deny_authenticated on public.organizations for all to authenticated using (false) with check (false);
drop policy if exists organizations_service_all on public.organizations;
create policy organizations_service_all on public.organizations for all to service_role using (true) with check (true);
drop policy if exists organization_memberships_deny_anon on public.organization_memberships;
create policy organization_memberships_deny_anon on public.organization_memberships for all to anon using (false) with check (false);
drop policy if exists organization_memberships_deny_authenticated on public.organization_memberships;
create policy organization_memberships_deny_authenticated on public.organization_memberships for all to authenticated using (false) with check (false);
drop policy if exists organization_memberships_service_all on public.organization_memberships;
create policy organization_memberships_service_all on public.organization_memberships for all to service_role using (true) with check (true);
