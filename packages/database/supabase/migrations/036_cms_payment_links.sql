-- CMS payment links used by admin content and campaigns.

create table if not exists public.cms_payment_links (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  provider text not null default 'stripe',
  payment_url text not null,
  description text not null default '',
  locale text not null default 'en',
  cta_label text not null default 'Pay now',
  active boolean not null default true,
  sort_order int not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_cms_payment_links_active_sort
  on public.cms_payment_links(active, sort_order, updated_at desc);

alter table public.cms_payment_links enable row level security;
