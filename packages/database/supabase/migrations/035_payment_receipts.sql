-- Migration 035: payment_receipts table for manual payment proof uploads (e.g. GCash/Maya receipt).
-- Admin reviews and confirms, then manually captures payment in Medusa when applicable.

create table if not exists public.payment_receipts (
  id             uuid primary key default gen_random_uuid(),
  order_id       text not null,
  user_id        uuid references auth.users(id) on delete set null,
  storage_path   text not null,
  public_url     text not null default '',
  mime_type      text not null default 'image/jpeg',
  file_size_bytes integer not null default 0,
  status         text not null default 'pending_review'
                   check (status in ('pending_review', 'approved', 'rejected')),
  reviewed_by    uuid references auth.users(id) on delete set null,
  reviewed_at    timestamptz,
  review_note    text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists payment_receipts_order_id_idx on public.payment_receipts(order_id);
create index if not exists payment_receipts_status_idx on public.payment_receipts(status);
create index if not exists payment_receipts_user_id_idx on public.payment_receipts(user_id);

-- RLS: customers can insert and read their own receipts; service role can do all
alter table public.payment_receipts enable row level security;

create policy "payment_receipts_customer_insert"
  on public.payment_receipts for insert
  to authenticated
  with check (auth.uid() = user_id or user_id is null);

create policy "payment_receipts_customer_select"
  on public.payment_receipts for select
  to authenticated
  using (auth.uid() = user_id);

create policy "payment_receipts_service_all"
  on public.payment_receipts for all
  to service_role
  using (true)
  with check (true);

-- Trigger: keep updated_at current
create or replace function public.set_payment_receipts_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists payment_receipts_updated_at on public.payment_receipts;
create trigger payment_receipts_updated_at
  before update on public.payment_receipts
  for each row execute function public.set_payment_receipts_updated_at();
