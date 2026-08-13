ALTER TABLE public.staff_catalog_inventory_audit
  ADD COLUMN IF NOT EXISTS organization_id text;

CREATE INDEX IF NOT EXISTS idx_staff_catalog_inventory_audit_org_created
  ON public.staff_catalog_inventory_audit (organization_id, created_at DESC);
