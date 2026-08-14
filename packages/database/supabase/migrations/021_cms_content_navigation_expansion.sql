-- CMS: page hierarchy, block presets, navigation mobile/footer bar, isolated nav draft (not exposed to anon).

alter table public.cms_pages
  add column if not exists parent_slug text,
  add column if not exists breadcrumb_label text;

create index if not exists idx_cms_pages_parent_slug on public.cms_pages(parent_slug)
  where parent_slug is not null;

alter table public.cms_navigation
  add column if not exists header_links_mobile jsonb not null default '[]'::jsonb,
  add column if not exists footer_bottom_links jsonb not null default '[]'::jsonb;

-- Draft workspace: no SELECT policies for anon/authenticated (admin API uses service role).
create table if not exists public.cms_navigation_draft (
  id text primary key default 'default',
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.cms_navigation_draft (id) values ('default') on conflict do nothing;

alter table public.cms_navigation_draft enable row level security;

create table if not exists public.cms_page_block_presets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  blocks jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.cms_page_block_presets enable row level security;
