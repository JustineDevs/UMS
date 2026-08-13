ALTER TABLE public.admin_invoices
  ADD COLUMN IF NOT EXISTS provider_retry_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS provider_retry_state text NOT NULL DEFAULT 'idle';

ALTER TABLE public.admin_invoices
  DROP CONSTRAINT IF EXISTS admin_invoices_provider_retry_state_check;
ALTER TABLE public.admin_invoices
  ADD CONSTRAINT admin_invoices_provider_retry_state_check
  CHECK (provider_retry_state IN ('idle', 'processing', 'retryable', 'permanent_failure'));

CREATE INDEX IF NOT EXISTS admin_invoices_provider_retry_idx
  ON public.admin_invoices(organization_id, provider_retry_state, provider_updated_at DESC);
