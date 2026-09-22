-- Employee records are organization-owned platform data.
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS organization_id text REFERENCES public.organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_employees_organization_created
  ON public.employees (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_employees_organization_active
  ON public.employees (organization_id, is_active);
