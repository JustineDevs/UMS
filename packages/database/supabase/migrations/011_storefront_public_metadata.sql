-- Public contact / social defaults (Instagram, support email, phone).
-- Edited in admin (service role). Storefront reads with anon + RLS SELECT.
-- Env vars remain optional fallbacks when a field is empty in CMS.

create table if not exists public.storefront_public_metadata (
  id text primary key default 'default',
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.storefront_public_metadata (id, payload)
values ('default', '{}'::jsonb)
on conflict (id) do nothing;

alter table public.storefront_public_metadata enable row level security;

drop policy if exists storefront_public_metadata_select_anon on public.storefront_public_metadata;
create policy storefront_public_metadata_select_anon
  on public.storefront_public_metadata for select
  to anon
  using (true);

drop policy if exists storefront_public_metadata_select_authenticated on public.storefront_public_metadata;
create policy storefront_public_metadata_select_authenticated
  on public.storefront_public_metadata for select
  to authenticated
  using (true);
