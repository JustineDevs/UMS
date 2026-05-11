-- Append-only staff catalog stock adjustment audit (platform ledger).
-- Medusa remains SoR for inventory; Medusa may own public.inventory_movements (inventory_reason enum).
-- This table name MUST NOT collide with Medusa core.

CREATE TABLE IF NOT EXISTS public.staff_catalog_inventory_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  actor_email text,
  reason text NOT NULL DEFAULT 'staff_catalog_stock_set',
  reference_type text NOT NULL,
  reference_id text NOT NULL,
  product_id text NOT NULL,
  variant_id text NOT NULL,
  inventory_item_id text,
  location_id text,
  quantity_before integer,
  quantity_after integer NOT NULL,
  quantity_delta integer NOT NULL,
  correlation_id text,
  metadata jsonb NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_staff_catalog_inventory_audit_product_created
  ON public.staff_catalog_inventory_audit (product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_staff_catalog_inventory_audit_variant_created
  ON public.staff_catalog_inventory_audit (variant_id, created_at DESC);

ALTER TABLE public.staff_catalog_inventory_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS staff_catalog_inventory_audit_service_role ON public.staff_catalog_inventory_audit;
CREATE POLICY staff_catalog_inventory_audit_service_role ON public.staff_catalog_inventory_audit
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS staff_catalog_inventory_audit_deny_anon ON public.staff_catalog_inventory_audit;
CREATE POLICY staff_catalog_inventory_audit_deny_anon ON public.staff_catalog_inventory_audit
  FOR ALL TO anon USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS staff_catalog_inventory_audit_deny_authenticated ON public.staff_catalog_inventory_audit;
CREATE POLICY staff_catalog_inventory_audit_deny_authenticated ON public.staff_catalog_inventory_audit
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.staff_catalog_inventory_audit_reject_update_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'staff_catalog_inventory_audit is append-only';
END;
$$;

DROP TRIGGER IF EXISTS staff_catalog_inventory_audit_append_only ON public.staff_catalog_inventory_audit;
CREATE TRIGGER staff_catalog_inventory_audit_append_only
  BEFORE UPDATE OR DELETE ON public.staff_catalog_inventory_audit
  FOR EACH ROW
  EXECUTE FUNCTION public.staff_catalog_inventory_audit_reject_update_delete();
