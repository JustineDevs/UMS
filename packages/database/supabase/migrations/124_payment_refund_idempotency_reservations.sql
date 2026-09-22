ALTER TABLE public.payment_refund_audit
  ADD COLUMN IF NOT EXISTS request_idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS payment_refund_audit_org_idempotency_uidx
  ON public.payment_refund_audit (organization_id, request_idempotency_key)
  WHERE organization_id IS NOT NULL AND request_idempotency_key IS NOT NULL;
