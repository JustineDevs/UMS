-- D-13/D-16/D-18: keep operational projections explicit while Medusa remains commerce authority.
COMMENT ON FUNCTION public.inventory_reservation_lifecycle(text, text, text, uuid, text, text, integer, integer, text, text, text, jsonb)
  IS 'p_available_quantity is Medusa stocked quantity; active reservations are subtracted to derive sellable quantity.';

CREATE TABLE IF NOT EXISTS public.refund_lifecycle_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id text NOT NULL, refund_id text NOT NULL,
  order_id text NOT NULL, amount_minor bigint NOT NULL CHECK (amount_minor > 0), currency text NOT NULL,
  status text NOT NULL CHECK (status IN ('requested','pending','succeeded','failed','cancelled')),
  provider_refund_id text, invoice_id text, last_error text, idempotency_key text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, refund_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS refund_lifecycle_order_idx ON public.refund_lifecycle_ledger (organization_id, order_id, updated_at DESC);
ALTER TABLE public.refund_lifecycle_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS refund_lifecycle_service_all ON public.refund_lifecycle_ledger;
CREATE POLICY refund_lifecycle_service_all ON public.refund_lifecycle_ledger FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.record_refund_lifecycle(
  p_organization_id text, p_refund_id text, p_order_id text, p_amount_minor bigint, p_currency text,
  p_status text, p_idempotency_key text, p_provider_refund_id text DEFAULT NULL, p_invoice_id text DEFAULT NULL,
  p_last_error text DEFAULT NULL, p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS public.refund_lifecycle_ledger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE old public.refund_lifecycle_ledger%ROWTYPE; result public.refund_lifecycle_ledger%ROWTYPE;
BEGIN
  SELECT * INTO old FROM public.refund_lifecycle_ledger WHERE organization_id = trim(p_organization_id) AND refund_id = trim(p_refund_id) ORDER BY updated_at DESC LIMIT 1 FOR UPDATE;
  IF FOUND AND old.status <> p_status AND NOT ((old.status = 'requested' AND p_status IN ('pending','failed','cancelled')) OR (old.status = 'pending' AND p_status IN ('succeeded','failed')) OR (old.status = 'failed' AND p_status IN ('pending','cancelled'))) THEN RAISE EXCEPTION 'invalid refund transition: % -> %', old.status, p_status; END IF;
  INSERT INTO public.refund_lifecycle_ledger (organization_id, refund_id, order_id, amount_minor, currency, status, provider_refund_id, invoice_id, last_error, idempotency_key, metadata)
  VALUES (trim(p_organization_id), trim(p_refund_id), trim(p_order_id), p_amount_minor, upper(trim(p_currency)), p_status, nullif(trim(p_provider_refund_id),''), nullif(trim(p_invoice_id),''), p_last_error, trim(p_idempotency_key), coalesce(p_metadata,'{}'::jsonb))
  ON CONFLICT (organization_id, refund_id, idempotency_key) DO UPDATE SET status = EXCLUDED.status, provider_refund_id = EXCLUDED.provider_refund_id, invoice_id = EXCLUDED.invoice_id, last_error = EXCLUDED.last_error, metadata = EXCLUDED.metadata, updated_at = now()
  RETURNING * INTO result;
  RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.record_refund_lifecycle(text,text,text,bigint,text,text,text,text,text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_refund_lifecycle(text,text,text,bigint,text,text,text,text,text,text,jsonb) TO service_role;
