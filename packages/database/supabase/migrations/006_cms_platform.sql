-- Full storefront CMS: pages, navigation, announcement, category copy, media, blog, forms, redirects, A/B.
-- Staff writes via admin API (service role). Public reads use anon + RLS.

create table if not exists public.cms_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  locale text not null default 'en',
  page_type text not null default 'static' check (page_type in ('static', 'landing', 'legal')),
  title text not null default '',
  body text not null default '',
  blocks jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'published', 'scheduled')),
  published_at timestamptz,
  scheduled_publish_at timestamptz,
  preview_token uuid,
  meta_title text,
  meta_description text,
  canonical_url text,
  og_image_url text,
  json_ld jsonb,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (slug, locale)
);

create table if not exists public.cms_page_versions (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.cms_pages(id) on delete cascade,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_cms_pages_slug_locale on public.cms_pages(slug, locale);
create index if not exists idx_cms_page_versions_page on public.cms_page_versions(page_id);

create table if not exists public.cms_navigation (
  id text primary key default 'default',
  header_links jsonb not null default '[]'::jsonb,
  footer_columns jsonb not null default '[]'::jsonb,
  social_links jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.cms_navigation (id) values ('default') on conflict do nothing;

create table if not exists public.cms_announcement (
  id text primary key default 'default',
  locale text not null default 'en',
  body text not null default '',
  link_url text,
  link_label text,
  dismissible boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.cms_announcement (id) values ('default') on conflict do nothing;

create table if not exists public.cms_category_content (
  id uuid primary key default gen_random_uuid(),
  collection_handle text not null,
  locale text not null default 'en',
  intro_html text not null default '',
  banner_url text,
  blocks jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  unique (collection_handle, locale)
);

create table if not exists public.cms_media (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null,
  public_url text not null,
  alt_text text,
  mime_type text,
  width int,
  height int,
  created_at timestamptz not null default now()
);

create table if not exists public.cms_blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  locale text not null default 'en',
  title text not null,
  excerpt text not null default '',
  body text not null default '',
  cover_image_url text,
  author_name text,
  tags text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'published', 'scheduled')),
  published_at timestamptz,
  scheduled_publish_at timestamptz,
  preview_token uuid,
  meta_title text,
  meta_description text,
  json_ld jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (slug, locale)
);

create index if not exists idx_cms_blog_slug on public.cms_blog_posts(slug, locale);

create table if not exists public.cms_form_submissions (
  id uuid primary key default gen_random_uuid(),
  form_key text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  ip_hash text
);

create table if not exists public.cms_redirects (
  id uuid primary key default gen_random_uuid(),
  from_path text not null unique,
  to_path text not null,
  status_code int not null default 301 check (status_code in (301, 302, 307, 308)),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_cms_redirects_from on public.cms_redirects(from_path) where active;

create table if not exists public.cms_ab_experiments (
  id uuid primary key default gen_random_uuid(),
  experiment_key text not null unique,
  name text not null default '',
  variants jsonb not null default '[]'::jsonb,
  active boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.cms_pages enable row level security;
alter table public.cms_page_versions enable row level security;
alter table public.cms_navigation enable row level security;
alter table public.cms_announcement enable row level security;
alter table public.cms_category_content enable row level security;
alter table public.cms_media enable row level security;
alter table public.cms_blog_posts enable row level security;
alter table public.cms_form_submissions enable row level security;
alter table public.cms_redirects enable row level security;
alter table public.cms_ab_experiments enable row level security;

drop policy if exists cms_pages_select_public on public.cms_pages;
create policy cms_pages_select_public on public.cms_pages
  for select to anon
  using (
    (
      status = 'published'
      and (published_at is null or published_at <= now())
    )
    or (
      status = 'scheduled'
      and scheduled_publish_at is not null
      and scheduled_publish_at <= now()
    )
  );

drop policy if exists cms_pages_select_authenticated on public.cms_pages;
create policy cms_pages_select_authenticated on public.cms_pages
  for select to authenticated
  using (
    (
      status = 'published'
      and (published_at is null or published_at <= now())
    )
    or (
      status = 'scheduled'
      and scheduled_publish_at is not null
      and scheduled_publish_at <= now()
    )
  );

drop policy if exists cms_navigation_select_anon on public.cms_navigation;
create policy cms_navigation_select_anon on public.cms_navigation for select to anon using (true);
drop policy if exists cms_navigation_select_auth on public.cms_navigation;
create policy cms_navigation_select_auth on public.cms_navigation for select to authenticated using (true);

drop policy if exists cms_announcement_select_anon on public.cms_announcement;
create policy cms_announcement_select_anon on public.cms_announcement for select to anon using (true);
drop policy if exists cms_announcement_select_auth on public.cms_announcement;
create policy cms_announcement_select_auth on public.cms_announcement for select to authenticated using (true);

drop policy if exists cms_category_content_select_anon on public.cms_category_content;
create policy cms_category_content_select_anon on public.cms_category_content for select to anon using (true);
drop policy if exists cms_category_content_select_auth on public.cms_category_content;
create policy cms_category_content_select_auth on public.cms_category_content for select to authenticated using (true);

drop policy if exists cms_blog_select_public on public.cms_blog_posts;
create policy cms_blog_select_public on public.cms_blog_posts
  for select to anon
  using (
    (
      status = 'published'
      and (published_at is null or published_at <= now())
    )
    or (
      status = 'scheduled'
      and scheduled_publish_at is not null
      and scheduled_publish_at <= now()
    )
  );

drop policy if exists cms_blog_select_auth on public.cms_blog_posts;
create policy cms_blog_select_auth on public.cms_blog_posts
  for select to authenticated
  using (
    (
      status = 'published'
      and (published_at is null or published_at <= now())
    )
    or (
      status = 'scheduled'
      and scheduled_publish_at is not null
      and scheduled_publish_at <= now()
    )
  );

drop policy if exists cms_redirects_select_anon on public.cms_redirects;
create policy cms_redirects_select_anon on public.cms_redirects
  for select to anon
  using (active = true);

drop policy if exists cms_redirects_select_auth on public.cms_redirects;
create policy cms_redirects_select_auth on public.cms_redirects
  for select to authenticated
  using (active = true);

drop policy if exists cms_ab_select_anon on public.cms_ab_experiments;
create policy cms_ab_select_anon on public.cms_ab_experiments
  for select to anon
  using (active = true);

drop policy if exists cms_ab_select_auth on public.cms_ab_experiments;
create policy cms_ab_select_auth on public.cms_ab_experiments
  for select to authenticated
  using (active = true);

drop policy if exists cms_media_select_anon on public.cms_media;
create policy cms_media_select_anon on public.cms_media for select to anon using (true);
drop policy if exists cms_media_select_auth on public.cms_media;
create policy cms_media_select_auth on public.cms_media for select to authenticated using (true);

drop policy if exists cms_form_submissions_insert_anon on public.cms_form_submissions;
create policy cms_form_submissions_insert_anon on public.cms_form_submissions
  for insert to anon
  with check (form_key in ('contact', 'newsletter', 'lead'));

drop policy if exists cms_form_submissions_insert_auth on public.cms_form_submissions;
create policy cms_form_submissions_insert_auth on public.cms_form_submissions
  for insert to authenticated
  with check (form_key in ('contact', 'newsletter', 'lead'));

drop policy if exists cms_page_versions_deny_anon on public.cms_page_versions;
create policy cms_page_versions_deny_anon on public.cms_page_versions for all to anon using (false) with check (false);

drop policy if exists cms_form_submissions_deny_anon_select on public.cms_form_submissions;
create policy cms_form_submissions_deny_anon_select on public.cms_form_submissions for select to anon using (false);

insert into storage.buckets (id, name, public)
values ('cms', 'cms', true)
on conflict (id) do nothing;

drop policy if exists cms_storage_objects_read_anon on storage.objects;
create policy cms_storage_objects_read_anon on storage.objects
  for select to anon
  using (bucket_id = 'cms');

drop policy if exists cms_storage_objects_read_auth on storage.objects;
create policy cms_storage_objects_read_auth on storage.objects
  for select to authenticated
  using (bucket_id = 'cms');
