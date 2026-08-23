-- D-23: attribution is tenant-owned and cannot be linked across stores.
ALTER TABLE public.commerce_attribution
  ADD COLUMN IF NOT EXISTS organization_id text;
ALTER TABLE public.commerce_attribution_refunds
  ADD COLUMN IF NOT EXISTS organization_id text;
CREATE INDEX IF NOT EXISTS commerce_attribution_org_order_idx
  ON public.commerce_attribution (organization_id, order_id);
CREATE INDEX IF NOT EXISTS commerce_attribution_refunds_org_order_idx
  ON public.commerce_attribution_refunds (organization_id, order_id);
