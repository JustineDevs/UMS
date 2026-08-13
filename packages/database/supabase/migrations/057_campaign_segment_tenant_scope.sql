-- Campaign and audience records must never cross organization boundaries.
alter table public.customer_segments add column if not exists organization_id text;
alter table public.customer_segment_members add column if not exists organization_id text;
alter table public.campaigns add column if not exists organization_id text;

create index if not exists idx_customer_segments_organization
  on public.customer_segments(organization_id, name);
create index if not exists idx_customer_segment_members_organization
  on public.customer_segment_members(organization_id, segment_id);
create index if not exists idx_campaigns_organization
  on public.campaigns(organization_id, created_at desc);
