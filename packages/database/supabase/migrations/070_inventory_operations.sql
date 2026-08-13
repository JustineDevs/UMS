CREATE TABLE IF NOT EXISTS public.inventory_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  source_location_id text NOT NULL,
  destination_location_id text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'in_transit', 'processing', 'completed', 'failed', 'cancelled')),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  idempotency_key text NOT NULL,
  failure_code text,
  failure_message text,
  created_by_email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (organization_id, idempotency_key),
  CHECK (source_location_id <> destination_location_id)
);

CREATE TABLE IF NOT EXISTS public.inventory_transfer_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id uuid NOT NULL REFERENCES public.inventory_transfers(id) ON DELETE CASCADE,
  product_id text NOT NULL,
  variant_id text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (transfer_id, variant_id)
);

CREATE TABLE IF NOT EXISTS public.inventory_purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  supplier_name text NOT NULL,
  destination_location_id text NOT NULL,
  currency_code text NOT NULL DEFAULT 'PHP' CHECK (currency_code = 'PHP'),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'partially_received', 'received', 'receiving', 'receive_failed', 'cancelled')),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  idempotency_key text NOT NULL,
  failure_code text,
  failure_message text,
  created_by_email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS public.inventory_purchase_order_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES public.inventory_purchase_orders(id) ON DELETE CASCADE,
  product_id text NOT NULL,
  variant_id text NOT NULL,
  ordered_quantity integer NOT NULL CHECK (ordered_quantity > 0),
  received_quantity integer NOT NULL DEFAULT 0 CHECK (received_quantity >= 0),
  unit_cost_minor integer NOT NULL CHECK (unit_cost_minor >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (purchase_order_id, variant_id),
  CHECK (received_quantity <= ordered_quantity)
);

CREATE TABLE IF NOT EXISTS public.inventory_cycle_counts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'processing', 'completed', 'failed', 'cancelled')),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  idempotency_key text NOT NULL,
  failure_code text,
  failure_message text,
  created_by_email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (organization_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS public.inventory_cycle_count_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_count_id uuid NOT NULL REFERENCES public.inventory_cycle_counts(id) ON DELETE CASCADE,
  product_id text NOT NULL,
  variant_id text NOT NULL,
  expected_quantity integer NOT NULL CHECK (expected_quantity >= 0),
  counted_quantity integer CHECK (counted_quantity >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cycle_count_id, variant_id)
);

CREATE INDEX IF NOT EXISTS inventory_transfers_org_created_idx
  ON public.inventory_transfers (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS inventory_purchase_orders_org_created_idx
  ON public.inventory_purchase_orders (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS inventory_cycle_counts_org_created_idx
  ON public.inventory_cycle_counts (organization_id, created_at DESC);

ALTER TABLE public.inventory_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transfer_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_purchase_order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_cycle_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_cycle_count_lines ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'inventory_transfers',
    'inventory_transfer_lines',
    'inventory_purchase_orders',
    'inventory_purchase_order_lines',
    'inventory_cycle_counts',
    'inventory_cycle_count_lines'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_service_role ON public.%I', table_name, table_name);
    EXECUTE format('CREATE POLICY %I_service_role ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)', table_name, table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I_deny_anon ON public.%I', table_name, table_name);
    EXECUTE format('CREATE POLICY %I_deny_anon ON public.%I FOR ALL TO anon USING (false) WITH CHECK (false)', table_name, table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I_deny_authenticated ON public.%I', table_name, table_name);
    EXECUTE format('CREATE POLICY %I_deny_authenticated ON public.%I FOR ALL TO authenticated USING (false) WITH CHECK (false)', table_name, table_name);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.inventory_operations_reject_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'inventory lifecycle records are immutable';
  END IF;
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    RAISE EXCEPTION 'inventory lifecycle ownership is immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS inventory_transfers_ownership_guard ON public.inventory_transfers;
CREATE TRIGGER inventory_transfers_ownership_guard
  BEFORE UPDATE OR DELETE ON public.inventory_transfers
  FOR EACH ROW EXECUTE FUNCTION public.inventory_operations_reject_mutation();
DROP TRIGGER IF EXISTS inventory_purchase_orders_ownership_guard ON public.inventory_purchase_orders;
CREATE TRIGGER inventory_purchase_orders_ownership_guard
  BEFORE UPDATE OR DELETE ON public.inventory_purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.inventory_operations_reject_mutation();
DROP TRIGGER IF EXISTS inventory_cycle_counts_ownership_guard ON public.inventory_cycle_counts;
CREATE TRIGGER inventory_cycle_counts_ownership_guard
  BEFORE UPDATE OR DELETE ON public.inventory_cycle_counts
  FOR EACH ROW EXECUTE FUNCTION public.inventory_operations_reject_mutation();
