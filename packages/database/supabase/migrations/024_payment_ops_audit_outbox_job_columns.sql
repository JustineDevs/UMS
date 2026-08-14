-- Operational audit tables and stronger outbox / job metadata for payment recovery.

ALTER TABLE public.outbox_events
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS next_retry_at timestamptz,
  ADD COLUMN IF NOT EXISTS retry_reason text;

CREATE INDEX IF NOT EXISTS idx_outbox_next_retry
  ON public.outbox_events (next_retry_at ASC NULLS LAST)
  WHERE processed_at IS NULL AND next_retry_at IS NOT NULL;

ALTER TABLE public.background_jobs
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_run_at timestamptz,
  ADD COLUMN IF NOT EXISTS locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS locked_by text,
  ADD COLUMN IF NOT EXISTS last_error text;

CREATE INDEX IF NOT EXISTS idx_jobs_runnable
  ON public.background_jobs (next_run_at ASC NULLS LAST, created_at ASC)
  WHERE status = 'queued' AND locked_at IS NULL;

CREATE TABLE IF NOT EXISTS public.payment_refund_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medusa_order_id text NOT NULL,
  medusa_payment_id text NOT NULL,
  amount_minor bigint NOT NULL,
  actor_email text,
  note text,
  request_correlation_id text,
  status text NOT NULL DEFAULT 'requested',
  result_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_refund_audit_order ON public.payment_refund_audit (medusa_order_id, created_at DESC);

ALTER TABLE public.payment_refund_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_full_access" ON public.payment_refund_audit;
CREATE POLICY "service_role_full_access" ON public.payment_refund_audit
  FOR ALL USING (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS public.customer_return_request_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medusa_order_id text NOT NULL,
  customer_email text NOT NULL,
  items jsonb NOT NULL DEFAULT '[]',
  note text,
  medusa_response jsonb,
  staff_review_job_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_return_audit_order ON public.customer_return_request_audit (medusa_order_id, created_at DESC);

ALTER TABLE public.customer_return_request_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_full_access" ON public.customer_return_request_audit;
CREATE POLICY "service_role_full_access" ON public.customer_return_request_audit
  FOR ALL USING (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION public.count_cod_delivered_pending_capture()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::bigint
  FROM public.payment_attempts
  WHERE provider = 'cod'
    AND (provider_payload->>'delivered_at') IS NOT NULL
    AND (provider_payload->>'cod_capture_complete') IS DISTINCT FROM 'true';
$$;
