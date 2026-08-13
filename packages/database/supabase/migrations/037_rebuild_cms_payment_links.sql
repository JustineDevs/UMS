-- Rebuild cms_payment_links for Universal Music commerce content.
-- Service-role writes only; table stays locked down by default RLS.

drop table if exists public.cms_payment_links cascade;

create table public.cms_payment_links (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) > 0),
  provider text not null default 'stripe' check (length(btrim(provider)) > 0),
  payment_url text not null check (length(btrim(payment_url)) > 0),
  description text not null default '',
  locale text not null default 'en' check (length(btrim(locale)) > 0),
  cta_label text not null default 'Pay now' check (length(btrim(cta_label)) > 0),
  active boolean not null default true,
  sort_order integer not null default 0 check (sort_order >= 0),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_cms_payment_links_active_sort
  on public.cms_payment_links(active, sort_order, updated_at desc);

create index if not exists idx_cms_payment_links_provider_locale_active
  on public.cms_payment_links(provider, locale, active, sort_order)
  where active;

alter table public.cms_payment_links enable row level security;

drop policy if exists cms_payment_links_deny_anon on public.cms_payment_links;
create policy cms_payment_links_deny_anon
  on public.cms_payment_links
  for all
  to anon
  using (false)
  with check (false);

drop policy if exists cms_payment_links_deny_authenticated on public.cms_payment_links;
create policy cms_payment_links_deny_authenticated
  on public.cms_payment_links
  for all
  to authenticated
  using (false)
  with check (false);

drop policy if exists cms_payment_links_service_all on public.cms_payment_links;
create policy cms_payment_links_service_all
  on public.cms_payment_links
  for all
  to service_role
  using (true)
  with check (true);

create or replace function public.set_cms_payment_links_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists cms_payment_links_updated_at on public.cms_payment_links;
create trigger cms_payment_links_updated_at
  before update on public.cms_payment_links
  for each row
  execute function public.set_cms_payment_links_updated_at();
