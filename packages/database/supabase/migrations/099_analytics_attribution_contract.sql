-- D-22/D-23: one server-owned attribution chain from cart to order to refund.
CREATE TABLE IF NOT EXISTS public.commerce_attribution (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id text, cart_id text NOT NULL UNIQUE,
  order_id text, source text, medium text, campaign text, campaign_id text,
  coupon_code text, referral_code text, created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS commerce_attribution_order_idx ON public.commerce_attribution(order_id);
ALTER TABLE public.commerce_attribution ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS commerce_attribution_service_all ON public.commerce_attribution;
CREATE POLICY commerce_attribution_service_all ON public.commerce_attribution FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.commerce_attribution_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id text, order_id text NOT NULL, refund_id text NOT NULL,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0), currency text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(order_id, refund_id)
);
CREATE INDEX IF NOT EXISTS commerce_attribution_refund_order_idx ON public.commerce_attribution_refunds(order_id);
ALTER TABLE public.commerce_attribution_refunds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS commerce_attribution_refunds_service_all ON public.commerce_attribution_refunds;
CREATE POLICY commerce_attribution_refunds_service_all ON public.commerce_attribution_refunds FOR ALL TO service_role USING (true) WITH CHECK (true);
