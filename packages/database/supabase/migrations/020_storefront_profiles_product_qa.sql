-- Storefront customer profile extensions (service-role API only; not Medusa customer SoR).
-- Product Q&A archive (public read approved; writes via service role / admin tooling).

create table if not exists public.storefront_customer_profiles (
  email text primary key
    check (char_length(email) >= 3 and char_length(email) <= 320 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  display_name text,
  phone text,
  avatar_url text,
  shipping_addresses jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists idx_storefront_customer_profiles_updated
  on public.storefront_customer_profiles (updated_at desc);

alter table public.storefront_customer_profiles enable row level security;

drop policy if exists "storefront_customer_profiles_deny_clients" on public.storefront_customer_profiles;
create policy "storefront_customer_profiles_deny_clients"
  on public.storefront_customer_profiles for all
  to anon, authenticated
  using (false)
  with check (false);

create table if not exists public.product_qa_entries (
  id uuid primary key default gen_random_uuid(),
  product_slug text not null,
  medusa_product_id text,
  question text not null check (char_length(question) >= 1 and char_length(question) <= 500),
  answer text not null check (char_length(answer) >= 1 and char_length(answer) <= 4000),
  sort_order int not null default 0,
  status text not null default 'approved'
    check (status in ('draft', 'approved')),
  created_at timestamptz not null default now()
);

create index if not exists idx_product_qa_slug_status_sort
  on public.product_qa_entries (product_slug, status, sort_order, created_at desc);

alter table public.product_qa_entries enable row level security;

drop policy if exists "product_qa_select_approved" on public.product_qa_entries;
create policy "product_qa_select_approved"
  on public.product_qa_entries for select
  to anon, authenticated
  using (status = 'approved');

drop policy if exists "product_qa_deny_insert_clients" on public.product_qa_entries;
create policy "product_qa_deny_insert_clients"
  on public.product_qa_entries for insert
  to anon, authenticated
  with check (false);

drop policy if exists "product_qa_deny_update_clients" on public.product_qa_entries;
create policy "product_qa_deny_update_clients"
  on public.product_qa_entries for update
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "product_qa_deny_delete_clients" on public.product_qa_entries;
create policy "product_qa_deny_delete_clients"
  on public.product_qa_entries for delete
  to anon, authenticated
  using (false);

alter table public.cart_abandonment_events
  add column if not exists recovery_email_sent_at timestamptz;
