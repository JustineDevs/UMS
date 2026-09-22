ALTER TABLE public.payment_refund_audit
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS provider_refund_id text,
  ADD COLUMN IF NOT EXISTS provider_status text;

CREATE UNIQUE INDEX IF NOT EXISTS payment_refund_audit_provider_refund_uidx
  ON public.payment_refund_audit (provider, provider_refund_id)
  WHERE provider_refund_id IS NOT NULL;
