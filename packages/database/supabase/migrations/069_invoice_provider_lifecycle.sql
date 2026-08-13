alter table public.admin_invoices
  add column if not exists provider text,
  add column if not exists provider_external_id text,
  add column if not exists provider_artifact_id uuid references public.payment_provider_artifacts(id) on delete set null,
  add column if not exists provider_status text,
  add column if not exists provider_last_error text,
  add column if not exists provider_updated_at timestamptz;

alter table public.admin_invoices
  drop constraint if exists admin_invoices_provider_check;
alter table public.admin_invoices
  add constraint admin_invoices_provider_check
  check (provider is null or provider in ('stripe', 'paypal', 'xendit'));

create unique index if not exists admin_invoices_org_provider_external_key
  on public.admin_invoices(organization_id, provider, provider_external_id)
  where provider is not null and provider_external_id is not null;

create index if not exists admin_invoices_provider_status_idx
  on public.admin_invoices(organization_id, provider, provider_status, updated_at desc);
