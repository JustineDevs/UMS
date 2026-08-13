create table if not exists public.pos_sale_ledger (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  order_id text not null,
  order_number text not null,
  shift_id text,
  terminal_id text,
  total_minor bigint not null check (total_minor >= 0),
  currency text not null default 'PHP',
  idempotency_key text,
  created_at timestamptz not null default now(),
  unique (organization_id, order_id),
  unique (organization_id, idempotency_key)
);
alter table public.pos_sale_ledger enable row level security;
drop policy if exists pos_sale_ledger_service_all on public.pos_sale_ledger;
create policy pos_sale_ledger_service_all on public.pos_sale_ledger for all to service_role using (true) with check (true);
