-- Product reviews (public read via anon; inserts only from server API using service role).
-- Cart abandonment events (service role inserts only).

create table if not exists public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_slug text not null,
  rating int not null check (rating >= 1 and rating <= 5),
  author_name text not null,
  body text not null check (char_length(body) >= 1 and char_length(body) <= 2000),
  created_at timestamptz not null default now()
);

create index if not exists idx_product_reviews_slug_created
  on public.product_reviews(product_slug, created_at desc);

alter table public.product_reviews enable row level security;

drop policy if exists "product_reviews_select_public" on public.product_reviews;
create policy "product_reviews_select_public"
  on public.product_reviews for select
  to anon, authenticated
  using (true);

drop policy if exists "product_reviews_deny_insert_clients" on public.product_reviews;
create policy "product_reviews_deny_insert_clients"
  on public.product_reviews for insert
  to anon, authenticated
  with check (false);

create table if not exists public.cart_abandonment_events (
  id uuid primary key default gen_random_uuid(),
  email text,
  line_count int not null default 0 check (line_count >= 0),
  subtotal_cents int,
  path text,
  referrer text,
  client_timestamp text,
  created_at timestamptz not null default now()
);

create index if not exists idx_cart_abandonment_created
  on public.cart_abandonment_events(created_at desc);

alter table public.cart_abandonment_events enable row level security;

drop policy if exists "cart_abandonment_deny_all_clients" on public.cart_abandonment_events;
create policy "cart_abandonment_deny_all_clients"
  on public.cart_abandonment_events for all
  to anon, authenticated
  using (false)
  with check (false);
