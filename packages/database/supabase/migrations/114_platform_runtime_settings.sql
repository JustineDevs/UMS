-- Tenant-scoped, non-secret runtime configuration. Provider credentials remain
-- deployment secrets and are intentionally excluded from this document.
create table if not exists public.platform_runtime_settings (
  organization_id text primary key references public.organizations(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.platform_runtime_settings_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists platform_runtime_settings_updated_at on public.platform_runtime_settings;
create trigger platform_runtime_settings_updated_at
before update on public.platform_runtime_settings
for each row execute function public.platform_runtime_settings_set_updated_at();

alter table public.platform_runtime_settings enable row level security;
drop policy if exists platform_runtime_settings_deny_anon on public.platform_runtime_settings;
create policy platform_runtime_settings_deny_anon
  on public.platform_runtime_settings for all to anon using (false) with check (false);
drop policy if exists platform_runtime_settings_deny_authenticated on public.platform_runtime_settings;
create policy platform_runtime_settings_deny_authenticated
  on public.platform_runtime_settings for all to authenticated using (false) with check (false);
drop policy if exists platform_runtime_settings_service_all on public.platform_runtime_settings;
create policy platform_runtime_settings_service_all
  on public.platform_runtime_settings for all to service_role using (true) with check (true);
