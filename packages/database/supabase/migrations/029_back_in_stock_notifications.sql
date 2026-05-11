-- Back-in-stock notification subscriptions (platform ledger, NOT Medusa core).
-- Stores email capture from OOS PDP; dispatch handled by a worker/subscriber.

CREATE TABLE IF NOT EXISTS public.back_in_stock_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  email text NOT NULL,
  product_id text NOT NULL,
  product_slug text,
  variant_id text,
  notified boolean NOT NULL DEFAULT false,
  notified_at timestamptz
);

-- Composite unique key matches the upsert conflict target in the storefront API route.
ALTER TABLE public.back_in_stock_notifications
  DROP CONSTRAINT IF EXISTS back_in_stock_notifications_email_product_variant_unique;

ALTER TABLE public.back_in_stock_notifications
  ADD CONSTRAINT back_in_stock_notifications_email_product_variant_unique
  UNIQUE (email, product_id, variant_id);

CREATE INDEX IF NOT EXISTS idx_back_in_stock_product_notified
  ON public.back_in_stock_notifications (product_id, notified)
  WHERE notified = false;

ALTER TABLE public.back_in_stock_notifications ENABLE ROW LEVEL SECURITY;

-- Service role (server-side API) has full access; anon/authenticated have no access.
DROP POLICY IF EXISTS back_in_stock_notifications_service_role ON public.back_in_stock_notifications;

CREATE POLICY back_in_stock_notifications_service_role
  ON public.back_in_stock_notifications
  TO service_role
  USING (true)
  WITH CHECK (true);
