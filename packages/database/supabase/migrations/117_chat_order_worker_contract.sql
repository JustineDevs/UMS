-- Native Worker cart/order references; retain legacy columns for rollback and audit.
ALTER TABLE public.chat_order_intake
  ADD COLUMN IF NOT EXISTS commerce_cart_id text,
  ADD COLUMN IF NOT EXISTS commerce_order_id text,
  ADD COLUMN IF NOT EXISTS commerce_order_display_id text,
  ADD COLUMN IF NOT EXISTS commerce_payment_status text;

UPDATE public.chat_order_intake
SET commerce_cart_id = COALESCE(commerce_cart_id, medusa_draft_order_id),
    commerce_order_id = COALESCE(commerce_order_id, medusa_order_id),
    commerce_order_display_id = COALESCE(commerce_order_display_id, medusa_order_display_id),
    commerce_payment_status = COALESCE(commerce_payment_status, medusa_order_payment_status)
WHERE commerce_cart_id IS NULL
   OR commerce_order_id IS NULL
   OR commerce_order_display_id IS NULL
   OR commerce_payment_status IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_order_intake_org_commerce_order
  ON public.chat_order_intake (organization_id, commerce_order_id)
  WHERE commerce_order_id IS NOT NULL;

COMMENT ON COLUMN public.chat_order_intake.commerce_cart_id IS
  'Worker-native commerce cart associated with this support ticket.';
