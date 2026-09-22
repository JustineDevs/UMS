-- Offline POS queue entries are organization-owned and must not be globally readable.
ALTER TABLE public.offline_pos_queue
  ADD COLUMN IF NOT EXISTS organization_id text REFERENCES public.organizations(id) ON DELETE CASCADE;

DO $$
BEGIN
  UPDATE public.offline_pos_queue target
  SET organization_id = membership.organization_id
  FROM public.organization_memberships membership
  JOIN public.employees employee ON lower(employee.email) = lower(membership.user_email)
  WHERE target.organization_id IS NULL AND target.employee_id = employee.id;

  UPDATE public.offline_pos_queue target
  SET organization_id = (SELECT id FROM public.organizations ORDER BY created_at LIMIT 1)
  WHERE target.organization_id IS NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_offline_queue_organization_status_created
  ON public.offline_pos_queue (organization_id, status, created_at ASC);
