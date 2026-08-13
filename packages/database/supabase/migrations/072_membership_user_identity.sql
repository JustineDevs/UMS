-- Authorization uses the immutable platform user id, not a mutable email address.
alter table public.organization_memberships
  add column if not exists auth_user_id text;

update public.organization_memberships membership
set auth_user_id = users.id::text
from public.users
where lower(users.email) = lower(membership.user_email)
  and membership.auth_user_id is null;

create index if not exists organization_memberships_auth_user_idx
  on public.organization_memberships(auth_user_id, active);

-- Do not fail deployment if legacy data contains multiple active owners. Block
-- new duplicate-owner writes while leaving an explicit recovery path for old data.
create or replace function public.enforce_one_active_owner()
returns trigger
language plpgsql
as $$
begin
  if NEW.role = 'owner' and NEW.active then
    if exists (
      select 1
      from public.organization_memberships existing
      where existing.organization_id = NEW.organization_id
        and existing.role = 'owner'
        and existing.active
        and (TG_OP = 'INSERT' or existing.user_email <> OLD.user_email)
    ) then
      raise exception 'organization already has an active owner';
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists organization_memberships_one_owner on public.organization_memberships;
create trigger organization_memberships_one_owner
before insert or update of organization_id, role, active
on public.organization_memberships
for each row execute function public.enforce_one_active_owner();

-- Existing invitations may predate a platform user record. They remain
-- inactive for authorization until the invitation is accepted and backfilled.
