-- CRM operational records must belong to the staff organization that owns them.
alter table public.crm_activities add column if not exists organization_id text;
alter table public.crm_pipeline_deals add column if not exists organization_id text;
alter table public.crm_goals add column if not exists organization_id text;

create index if not exists idx_crm_activities_organization
  on public.crm_activities(organization_id, occurred_at desc);
create index if not exists idx_crm_pipeline_deals_organization
  on public.crm_pipeline_deals(organization_id, updated_at desc);
create index if not exists idx_crm_goals_organization
  on public.crm_goals(organization_id, period_start desc);

create unique index if not exists idx_crm_goals_organization_period
  on public.crm_goals(organization_id, owner_email, period_start, period_end)
  where organization_id is not null;
