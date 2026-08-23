alter table public.product_reviews
  add column if not exists body_hash text,
  add column if not exists risk_score integer not null default 0,
  add column if not exists shadow_banned boolean not null default false;

create unique index if not exists idx_product_reviews_active_body_hash
  on public.product_reviews(body_hash)
  where body_hash is not null and status in ('pending', 'approved', 'hidden');

create table if not exists public.product_review_reports (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.product_reviews(id) on delete cascade,
  reporter_email text not null,
  reporter_ip text,
  reason text not null check (reason in ('spam', 'harassment', 'hate', 'personal_data', 'other')),
  details text,
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  unique (review_id, reporter_email)
);

create index if not exists idx_product_review_reports_status_created
  on public.product_review_reports(status, created_at desc);

alter table public.product_review_reports enable row level security;
drop policy if exists product_review_reports_service_role on public.product_review_reports;
create policy product_review_reports_service_role on public.product_review_reports
  for all to service_role using (true) with check (true);
