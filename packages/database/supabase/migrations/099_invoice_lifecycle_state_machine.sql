-- D-20: invoice document lifecycle is an atomic, tenant-scoped state machine.
ALTER TABLE public.admin_invoices DROP CONSTRAINT IF EXISTS admin_invoices_status_check;
ALTER TABLE public.admin_invoices ADD CONSTRAINT admin_invoices_status_check
  CHECK (status IN ('draft', 'sending', 'sent', 'failed', 'retryable', 'voided', 'refunded'));

CREATE TABLE IF NOT EXISTS public.admin_invoice_lifecycle_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id text NOT NULL,
  invoice_id uuid NOT NULL REFERENCES public.admin_invoices(id) ON DELETE CASCADE,
  event text NOT NULL CHECK (event IN ('create', 'send', 'fail', 'retry', 'void', 'refund')),
  status text NOT NULL, fiscal_status text NOT NULL, idempotency_key text NOT NULL,
  error_message text, metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, invoice_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS admin_invoice_lifecycle_events_invoice_idx
  ON public.admin_invoice_lifecycle_events (organization_id, invoice_id, created_at DESC);
ALTER TABLE public.admin_invoice_lifecycle_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_invoice_lifecycle_events_service_all ON public.admin_invoice_lifecycle_events;
CREATE POLICY admin_invoice_lifecycle_events_service_all ON public.admin_invoice_lifecycle_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.record_invoice_lifecycle(
  p_organization_id text, p_invoice_id uuid, p_event text, p_status text,
  p_fiscal_status text, p_idempotency_key text, p_error_message text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE current_invoice public.admin_invoices%ROWTYPE;
DECLARE prior_event public.admin_invoice_lifecycle_events%ROWTYPE;
BEGIN
  SELECT * INTO current_invoice FROM public.admin_invoices
    WHERE id = p_invoice_id AND organization_id = trim(p_organization_id) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invoice not found'; END IF;
  SELECT * INTO prior_event FROM public.admin_invoice_lifecycle_events
    WHERE organization_id = trim(p_organization_id) AND invoice_id = p_invoice_id
      AND idempotency_key = trim(p_idempotency_key);
  IF FOUND THEN RETURN to_jsonb(current_invoice); END IF;
  IF p_fiscal_status NOT IN ('non_fiscal', 'draft', 'issued', 'voided') THEN RAISE EXCEPTION 'invalid fiscal status'; END IF;
  IF current_invoice.document_kind <> 'fiscal_invoice' AND p_fiscal_status <> 'non_fiscal' THEN RAISE EXCEPTION 'non-fiscal invoice cannot have fiscal status'; END IF;
  IF p_event = 'create' THEN
    IF current_invoice.status <> 'draft' OR EXISTS (SELECT 1 FROM public.admin_invoice_lifecycle_events WHERE organization_id = trim(p_organization_id) AND invoice_id = p_invoice_id) THEN RAISE EXCEPTION 'invalid invoice transition: create'; END IF;
  ELSIF NOT (
    (p_event = 'send' AND current_invoice.status = 'draft' AND p_status = 'sending') OR
    (p_event = 'send' AND current_invoice.status = 'sending' AND p_status = 'sent') OR
    (p_event = 'fail' AND current_invoice.status IN ('draft','sending') AND p_status = 'failed') OR
    (p_event = 'retry' AND current_invoice.status = 'failed' AND p_status = 'retryable') OR
    (p_event = 'void' AND current_invoice.status IN ('draft','sending','sent','failed','retryable') AND p_status = 'voided') OR
    (p_event = 'refund' AND current_invoice.status = 'sent' AND p_status = 'refunded')
  ) THEN RAISE EXCEPTION 'invalid invoice transition: % -> %', current_invoice.status, p_status; END IF;
  IF p_event = 'create' AND p_status <> 'draft' THEN RAISE EXCEPTION 'create must start in draft'; END IF;
  IF p_event = 'void' AND current_invoice.document_kind = 'fiscal_invoice' AND p_fiscal_status <> 'voided' THEN RAISE EXCEPTION 'void must void fiscal document'; END IF;
  UPDATE public.admin_invoices SET status = p_status, fiscal_status = p_fiscal_status, updated_at = now()
    WHERE id = p_invoice_id AND organization_id = trim(p_organization_id);
  INSERT INTO public.admin_invoice_lifecycle_events
    (organization_id, invoice_id, event, status, fiscal_status, idempotency_key, error_message, metadata)
  VALUES (trim(p_organization_id), p_invoice_id, p_event, p_status, p_fiscal_status,
    trim(p_idempotency_key), nullif(trim(p_error_message), ''), coalesce(p_metadata, '{}'::jsonb));
  SELECT * INTO current_invoice FROM public.admin_invoices WHERE id = p_invoice_id;
  RETURN to_jsonb(current_invoice);
END; $$;
REVOKE ALL ON FUNCTION public.record_invoice_lifecycle(text, uuid, text, text, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_invoice_lifecycle(text, uuid, text, text, text, text, text, jsonb) TO service_role;
