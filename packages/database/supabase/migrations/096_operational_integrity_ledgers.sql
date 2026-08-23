-- Full-task(2): make operational ownership and reconciliation explicit.
-- Medusa remains the commerce authority; these tables are append-only/transition ledgers.

ALTER TABLE public.inventory_reservations
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS expired_at timestamptz,
  ADD COLUMN IF NOT EXISTS reconciliation_status text NOT NULL DEFAULT 'pending';

ALTER TABLE public.inventory_reservations
  DROP CONSTRAINT IF EXISTS inventory_reservations_reconciliation_status_check;
ALTER TABLE public.inventory_reservations
  ADD CONSTRAINT inventory_reservations_reconciliation_status_check
  CHECK (reconciliation_status IN ('pending', 'matched', 'discrepancy', 'needs_review', 'resolved'));

CREATE INDEX IF NOT EXISTS inventory_reservations_expiry_idx
  ON public.inventory_reservations (tenant_id, expires_at)
  WHERE status = 'active' AND expires_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.inventory_reservation_expire(
  p_tenant_id text,
  p_reservation_id uuid,
  p_idempotency_key text
)
RETURNS public.inventory_reservations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE target public.inventory_reservations%ROWTYPE;
BEGIN
  SELECT * INTO target FROM public.inventory_reservations
  WHERE id = p_reservation_id AND tenant_id = trim(p_tenant_id) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'reservation not found'; END IF;
  IF target.status <> 'active' THEN RETURN target; END IF;
  IF target.expires_at IS NULL OR target.expires_at > now() THEN
    RAISE EXCEPTION 'reservation has not expired';
  END IF;
  UPDATE public.inventory_reservations
  SET status = 'released', released_at = now(), expired_at = now(),
      release_idempotency_key = trim(p_idempotency_key), updated_at = now()
  WHERE id = target.id
  RETURNING * INTO target;
  RETURN target;
END;
$$;

CREATE OR REPLACE FUNCTION public.inventory_reservation_set_expiry(
  p_tenant_id text,
  p_reservation_id uuid,
  p_expires_at timestamptz
)
RETURNS public.inventory_reservations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE target public.inventory_reservations%ROWTYPE;
BEGIN
  IF p_expires_at IS NULL OR p_expires_at <= now() THEN
    RAISE EXCEPTION 'expires_at must be in the future';
  END IF;
  UPDATE public.inventory_reservations
  SET expires_at = p_expires_at, updated_at = now()
  WHERE id = p_reservation_id AND tenant_id = trim(p_tenant_id) AND status = 'active'
  RETURNING * INTO target;
  IF NOT FOUND THEN RAISE EXCEPTION 'active reservation not found'; END IF;
  RETURN target;
END;
$$;

CREATE OR REPLACE FUNCTION public.inventory_reservation_expire_due(
  p_tenant_id text,
  p_limit integer DEFAULT 500
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE changed integer;
BEGIN
  WITH due AS (
    SELECT id FROM public.inventory_reservations
    WHERE tenant_id = trim(p_tenant_id) AND status = 'active'
      AND expires_at IS NOT NULL AND expires_at <= now()
    ORDER BY expires_at ASC LIMIT greatest(1, least(p_limit, 5000)) FOR UPDATE SKIP LOCKED
  )
  UPDATE public.inventory_reservations r
  SET status = 'released', released_at = now(), expired_at = now(),
      reconciliation_status = 'pending', updated_at = now()
  FROM due WHERE r.id = due.id;
  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed;
END;
$$;

CREATE TABLE IF NOT EXISTS public.canonical_order_state_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id text NOT NULL,
  medusa_order_id text NOT NULL,
  status text NOT NULL CHECK (status IN (
    'pending', 'paid', 'processing', 'packed', 'shipped', 'delivered',
    'cancelled', 'returned', 'refunded', 'failed'
  )),
  previous_status text,
  event_type text NOT NULL,
  source text NOT NULL,
  idempotency_key text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, medusa_order_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS canonical_order_state_ledger_order_idx
  ON public.canonical_order_state_ledger (organization_id, medusa_order_id, occurred_at DESC);
ALTER TABLE public.canonical_order_state_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS canonical_order_state_ledger_service_all ON public.canonical_order_state_ledger;
CREATE POLICY canonical_order_state_ledger_service_all ON public.canonical_order_state_ledger
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.append_canonical_order_state(
  p_organization_id text,
  p_medusa_order_id text,
  p_status text,
  p_event_type text,
  p_source text,
  p_idempotency_key text,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_occurred_at timestamptz DEFAULT now()
)
RETURNS public.canonical_order_state_ledger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE previous public.canonical_order_state_ledger%ROWTYPE;
DECLARE existing public.canonical_order_state_ledger%ROWTYPE;
DECLARE inserted public.canonical_order_state_ledger%ROWTYPE;
BEGIN
  SELECT * INTO existing FROM public.canonical_order_state_ledger
  WHERE organization_id = trim(p_organization_id)
    AND medusa_order_id = trim(p_medusa_order_id)
    AND idempotency_key = trim(p_idempotency_key);
  IF FOUND THEN RETURN existing; END IF;
  SELECT * INTO previous FROM public.canonical_order_state_ledger
  WHERE organization_id = trim(p_organization_id) AND medusa_order_id = trim(p_medusa_order_id)
  ORDER BY occurred_at DESC, created_at DESC LIMIT 1 FOR UPDATE;
  IF FOUND AND previous.status <> p_status AND NOT (
    (previous.status = 'pending' AND p_status IN ('paid','cancelled','failed')) OR
    (previous.status = 'paid' AND p_status IN ('processing','cancelled','refunded')) OR
    (previous.status = 'processing' AND p_status IN ('packed','cancelled','refunded')) OR
    (previous.status = 'packed' AND p_status IN ('shipped','cancelled')) OR
    (previous.status = 'shipped' AND p_status IN ('delivered','returned')) OR
    (previous.status = 'delivered' AND p_status IN ('returned','refunded')) OR
    (previous.status = 'returned' AND p_status = 'refunded') OR
    (previous.status = 'failed' AND p_status IN ('pending','cancelled'))
  ) THEN RAISE EXCEPTION 'invalid canonical order transition: % -> %', previous.status, p_status; END IF;
  INSERT INTO public.canonical_order_state_ledger (
    organization_id, medusa_order_id, status, previous_status, event_type, source,
    idempotency_key, metadata, occurred_at
  ) VALUES (
    trim(p_organization_id), trim(p_medusa_order_id), p_status,
    CASE WHEN FOUND THEN previous.status ELSE NULL END,
    trim(p_event_type), trim(p_source), trim(p_idempotency_key), coalesce(p_metadata, '{}'::jsonb), p_occurred_at
  ) RETURNING * INTO inserted;
  RETURN inserted;
END;
$$;

ALTER TABLE public.delivery_logistics_shipments
  ADD COLUMN IF NOT EXISTS organization_id text;
UPDATE public.delivery_logistics_shipments
SET organization_id = COALESCE(NULLIF(organization_id, ''), NULLIF(tenant_key, ''), 'default')
WHERE organization_id IS NULL OR organization_id = '';
ALTER TABLE public.delivery_logistics_shipments
  ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.delivery_logistics_shipments
  ADD COLUMN IF NOT EXISTS medusa_fulfillment_id text,
  ADD COLUMN IF NOT EXISTS provider_shipment_id text,
  ADD COLUMN IF NOT EXISTS eta_at timestamptz,
  ADD COLUMN IF NOT EXISTS idempotency_key text;
CREATE UNIQUE INDEX IF NOT EXISTS delivery_shipments_org_order_key
  ON public.delivery_logistics_shipments (organization_id, order_id);
CREATE UNIQUE INDEX IF NOT EXISTS delivery_shipments_org_idempotency_key
  ON public.delivery_logistics_shipments (organization_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS delivery_shipments_org_status_idx
  ON public.delivery_logistics_shipments (organization_id, status, updated_at DESC);

ALTER TABLE public.delivery_logistics_events
  ADD COLUMN IF NOT EXISTS organization_id text,
  ADD COLUMN IF NOT EXISTS idempotency_key text;
UPDATE public.delivery_logistics_events e
SET organization_id = s.organization_id
FROM public.delivery_logistics_shipments s
WHERE e.shipment_id = s.id AND e.organization_id IS NULL;
ALTER TABLE public.delivery_logistics_events
  ALTER COLUMN organization_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS delivery_events_org_idempotency_key
  ON public.delivery_logistics_events (organization_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.payment_settlement_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id text NOT NULL,
  provider text NOT NULL CHECK (provider IN ('stripe', 'paypal', 'xendit')),
  merchant_identity text NOT NULL,
  external_id text NOT NULL,
  artifact_type text NOT NULL CHECK (artifact_type IN ('balance_transaction', 'payout', 'settlement', 'refund', 'dispute')),
  payment_external_id text,
  medusa_order_id text,
  amount_minor bigint,
  fee_minor bigint NOT NULL DEFAULT 0,
  net_minor bigint,
  currency text,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'fetching_provider_data', 'matched', 'discrepancy', 'needs_review', 'resolved', 'failed')),
  provider_occurred_at timestamptz,
  idempotency_key text NOT NULL,
  mismatch_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, provider, artifact_type, external_id),
  UNIQUE (organization_id, provider, idempotency_key)
);
CREATE INDEX IF NOT EXISTS payment_settlement_records_match_idx
  ON public.payment_settlement_records (organization_id, provider, medusa_order_id, status, updated_at DESC);
ALTER TABLE public.payment_settlement_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payment_settlement_records_service_all ON public.payment_settlement_records;
CREATE POLICY payment_settlement_records_service_all ON public.payment_settlement_records
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.admin_invoices
  ADD COLUMN IF NOT EXISTS document_kind text NOT NULL DEFAULT 'admin_artifact',
  ADD COLUMN IF NOT EXISTS fiscal_status text NOT NULL DEFAULT 'non_fiscal',
  ADD COLUMN IF NOT EXISTS fiscal_number text,
  ADD COLUMN IF NOT EXISTS medusa_order_id text,
  ADD COLUMN IF NOT EXISTS refund_id text;
ALTER TABLE public.admin_invoices
  DROP CONSTRAINT IF EXISTS admin_invoices_document_kind_check,
  DROP CONSTRAINT IF EXISTS admin_invoices_fiscal_status_check,
  DROP CONSTRAINT IF EXISTS admin_invoices_fiscal_boundary_check;
ALTER TABLE public.admin_invoices
  ADD CONSTRAINT admin_invoices_document_kind_check
    CHECK (document_kind IN ('admin_artifact', 'commercial_invoice', 'fiscal_invoice')),
  ADD CONSTRAINT admin_invoices_fiscal_status_check
    CHECK (fiscal_status IN ('non_fiscal', 'draft', 'issued', 'voided')),
  ADD CONSTRAINT admin_invoices_fiscal_boundary_check
    CHECK (
      (document_kind <> 'fiscal_invoice' AND fiscal_status = 'non_fiscal' AND fiscal_number IS NULL)
      OR (document_kind = 'fiscal_invoice' AND fiscal_status IN ('draft', 'issued', 'voided') AND fiscal_number IS NOT NULL)
    );
CREATE INDEX IF NOT EXISTS admin_invoices_order_idx
  ON public.admin_invoices (organization_id, medusa_order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_invoices_refund_idx
  ON public.admin_invoices (organization_id, refund_id, created_at DESC);

ALTER TABLE public.payment_receipts
  ADD COLUMN IF NOT EXISTS organization_id text NOT NULL DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS payment_attempt_id uuid,
  ADD COLUMN IF NOT EXISTS customer_email text;
CREATE INDEX IF NOT EXISTS payment_receipts_org_order_idx
  ON public.payment_receipts (organization_id, order_id, created_at DESC);
