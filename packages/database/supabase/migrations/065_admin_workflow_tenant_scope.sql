-- Workflow overlays are tenant data. Keep the legacy rows readable only by
-- their owning organization after the application starts writing scoped rows.
alter table public.admin_entity_workflow
  add column if not exists organization_id text;

update public.admin_entity_workflow workflow
set organization_id = membership.organization_id
from public.organization_memberships membership
where workflow.organization_id is null
  and lower(workflow.actor_email) = lower(membership.user_email)
  and membership.active = true;

alter table public.admin_entity_workflow
  drop constraint if exists admin_entity_workflow_entity_type_entity_id_key;
drop index if exists public.admin_entity_workflow_entity_unique;
drop index if exists public.admin_entity_workflow_entity_idx;
create unique index if not exists admin_entity_workflow_org_entity_unique
  on public.admin_entity_workflow (organization_id, entity_type, entity_id)
  where organization_id is not null;
create index if not exists admin_entity_workflow_org_state_idx
  on public.admin_entity_workflow (organization_id, entity_type, state);

alter table public.admin_entity_workflow
  drop constraint if exists admin_entity_workflow_entity_type_check;
alter table public.admin_entity_workflow
  add constraint admin_entity_workflow_entity_type_check check (
    entity_type in (
      'catalog_product',
      'sales_order',
      'inventory_adjustment',
      'campaign',
      'cms_page',
      'chat_order'
    )
  );
