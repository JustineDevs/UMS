-- Public marketing copy for the storefront home page (hero, tiles, newsletter).
-- Staff updates via admin API (service role). Storefront reads with anon key + RLS SELECT.

create table if not exists public.storefront_home_content (
  id text primary key default 'default',
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.storefront_home_content (id, payload)
values ('default', '{}'::jsonb)
on conflict (id) do nothing;

alter table public.storefront_home_content enable row level security;

-- Intentionally readable by anon so the public Next.js storefront can load copy without the service role key.
-- Idempotent: safe to re-run migrate when policies already exist.
drop policy if exists storefront_home_content_select_anon on public.storefront_home_content;
create policy storefront_home_content_select_anon
  on public.storefront_home_content for select
  to anon
  using (true);

drop policy if exists storefront_home_content_select_authenticated on public.storefront_home_content;
create policy storefront_home_content_select_authenticated
  on public.storefront_home_content for select
  to authenticated
  using (true);
