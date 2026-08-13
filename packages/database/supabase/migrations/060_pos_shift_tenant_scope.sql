ALTER TABLE public.pos_shifts ADD COLUMN IF NOT EXISTS organization_id text;
CREATE INDEX IF NOT EXISTS pos_shifts_organization_idx
  ON public.pos_shifts (organization_id, opened_at DESC);

DO $$
BEGIN
  UPDATE public.pos_shifts target
  SET organization_id = employee_org.organization_id
  FROM public.organization_memberships employee_org
  JOIN public.employees employee
    ON lower(employee.email) = lower(employee_org.user_email)
  WHERE target.organization_id IS NULL
    AND employee.id = target.employee_id;

  UPDATE public.pos_shifts target
  SET organization_id = (SELECT id FROM public.organizations ORDER BY created_at LIMIT 1)
  WHERE target.organization_id IS NULL;
END $$;

ALTER TABLE public.pos_shift_reconciliations ADD COLUMN IF NOT EXISTS organization_id text;
CREATE INDEX IF NOT EXISTS pos_shift_reconciliations_organization_idx
  ON public.pos_shift_reconciliations (organization_id, created_at DESC);

UPDATE public.pos_shift_reconciliations reconciliation
SET organization_id = shift.organization_id
FROM public.pos_shifts shift
WHERE reconciliation.organization_id IS NULL
  AND reconciliation.shift_id = shift.id;

ALTER TABLE public.pos_voids ADD COLUMN IF NOT EXISTS organization_id text;
CREATE INDEX IF NOT EXISTS pos_voids_organization_idx
  ON public.pos_voids (organization_id, created_at DESC);
UPDATE public.pos_voids target
SET organization_id = shift.organization_id
FROM public.pos_shifts shift
WHERE target.organization_id IS NULL
  AND target.shift_id = shift.id;
