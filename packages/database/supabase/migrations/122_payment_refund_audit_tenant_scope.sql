ALTER TABLE public.payment_refund_audit
  ADD COLUMN IF NOT EXISTS organization_id text;

CREATE INDEX IF NOT EXISTS idx_refund_audit_tenant_order
  ON public.payment_refund_audit (organization_id, medusa_order_id, created_at DESC);
