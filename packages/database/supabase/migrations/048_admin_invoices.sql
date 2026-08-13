-- Admin-created invoices are platform artifacts; Medusa remains the commerce source of truth.
create table if not exists public.admin_invoices (
  id uuid primary key default gen_random_uuid(),
  reference_number text not null,
  status text not null default 'draft' check (status in ('draft', 'sent', 'failed')),
  currency text not null default 'PHP' check (currency = 'PHP'),
  total numeric(14,2) not null default 0 check (total >= 0),
  recipient_email text,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  sent_at timestamptz,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists admin_invoices_reference_number_key on public.admin_invoices(reference_number);
create index if not exists admin_invoices_created_at_idx on public.admin_invoices(created_at desc);
alter table public.admin_invoices enable row level security;
drop policy if exists admin_invoices_deny_anon on public.admin_invoices;
create policy admin_invoices_deny_anon on public.admin_invoices for all to anon using (false) with check (false);
drop policy if exists admin_invoices_deny_authenticated on public.admin_invoices;
create policy admin_invoices_deny_authenticated on public.admin_invoices for all to authenticated using (false) with check (false);
drop policy if exists admin_invoices_service_all on public.admin_invoices;
create policy admin_invoices_service_all on public.admin_invoices for all to service_role using (true) with check (true);
