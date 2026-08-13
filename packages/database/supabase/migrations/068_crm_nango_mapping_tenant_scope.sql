-- CRM customer mappings must be owned by the same organization as the Nango connection.
alter table public.crm_nango_mappings
  add column if not exists organization_id text;

create index if not exists idx_crm_nango_mappings_organization
  on public.crm_nango_mappings(organization_id, updated_at desc);

create unique index if not exists idx_crm_nango_mappings_tenant_unique
  on public.crm_nango_mappings(organization_id, customer_email, nango_provider, nango_connection_id);
