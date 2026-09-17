-- Durable customer order-handling preferences. Keep this separate from
-- marketing consent because it changes fulfillment behavior, not messaging.
CREATE TABLE IF NOT EXISTS public.customer_order_preferences (
  organization_id uuid NULL,
  customer_email text NOT NULL,
  out_of_stock_action text NOT NULL DEFAULT 'remove_and_continue',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, customer_email),
  CONSTRAINT customer_order_preferences_action_check
    CHECK (out_of_stock_action IN ('remove_and_continue', 'cancel_order', 'ask_me'))
);

CREATE INDEX IF NOT EXISTS customer_order_preferences_email_idx
  ON public.customer_order_preferences (organization_id, customer_email);

ALTER TABLE public.customer_order_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS customer_order_preferences_deny_anon ON public.customer_order_preferences;
CREATE POLICY customer_order_preferences_deny_anon
  ON public.customer_order_preferences FOR ALL TO anon USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS customer_order_preferences_deny_authenticated ON public.customer_order_preferences;
CREATE POLICY customer_order_preferences_deny_authenticated
  ON public.customer_order_preferences FOR ALL TO authenticated USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS customer_order_preferences_service_all ON public.customer_order_preferences;
CREATE POLICY customer_order_preferences_service_all
  ON public.customer_order_preferences FOR ALL TO service_role USING (true) WITH CHECK (true);
