alter table public.admin_invoices add column if not exists organization_id text;
alter table public.digital_receipts add column if not exists organization_id text;
create index if not exists admin_invoices_organization_created_idx
  on public.admin_invoices(organization_id, created_at desc);
create index if not exists digital_receipts_organization_created_idx
  on public.digital_receipts(organization_id, created_at desc);
