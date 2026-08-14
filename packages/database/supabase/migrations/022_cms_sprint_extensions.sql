-- CMS sprint: announcements (multi-locale, stacking), analytics, media soft-delete,
-- form workflow fields, redirect query preservation, experiments scheduling, blog SEO, form settings.

-- Announcements: composite primary key (id, locale)
alter table public.cms_announcement drop constraint if exists cms_announcement_pkey;
alter table public.cms_announcement add primary key (id, locale);

alter table public.cms_announcement
  add column if not exists body_format text not null default 'plain'
    check (body_format in ('plain', 'html')),
  add column if not exists priority int not null default 0,
  add column if not exists stack_group text,
  add column if not exists region_code text;

create table if not exists public.cms_announcement_analytics (
  announcement_id text not null,
  locale text not null default 'en',
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  dismisses bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (announcement_id, locale)
);

alter table public.cms_announcement_analytics enable row level security;

drop policy if exists cms_ann_analytics_deny_anon on public.cms_announcement_analytics;
create policy cms_ann_analytics_deny_anon on public.cms_announcement_analytics
  for all to anon using (false) with check (false);

drop policy if exists cms_ann_analytics_deny_auth on public.cms_announcement_analytics;
create policy cms_ann_analytics_deny_auth on public.cms_announcement_analytics
  for all to authenticated using (false) with check (false);

create table if not exists public.cms_form_settings (
  id text primary key default 'default',
  webhook_url text,
  notify_email text,
  updated_at timestamptz not null default now()
);

insert into public.cms_form_settings (id) values ('default') on conflict (id) do nothing;

alter table public.cms_form_settings enable row level security;

drop policy if exists cms_form_settings_deny_anon on public.cms_form_settings;
create policy cms_form_settings_deny_anon on public.cms_form_settings
  for all to anon using (false) with check (false);

drop policy if exists cms_form_settings_deny_auth on public.cms_form_settings;
create policy cms_form_settings_deny_auth on public.cms_form_settings
  for all to authenticated using (false) with check (false);

alter table public.cms_form_submissions
  add column if not exists read_at timestamptz,
  add column if not exists assigned_to text,
  add column if not exists spam_score numeric not null default 0;

alter table public.cms_media
  add column if not exists deleted_at timestamptz,
  add column if not exists display_name text,
  add column if not exists byte_size bigint,
  add column if not exists tags text[] not null default '{}';

alter table public.cms_redirects
  add column if not exists preserve_query boolean not null default false;

alter table public.cms_ab_experiments
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at timestamptz,
  add column if not exists traffic_cap_pct numeric(5,2),
  add column if not exists target_page_slug text,
  add column if not exists target_component_key text,
  add column if not exists impressions bigint not null default 0,
  add column if not exists conversions bigint not null default 0;

alter table public.cms_blog_posts
  add column if not exists canonical_url text,
  add column if not exists og_image_url text,
  add column if not exists rss_include boolean not null default true;
