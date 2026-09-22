ALTER TABLE public.public_delivery_attempts
  DROP CONSTRAINT IF EXISTS public_delivery_attempts_delivery_kind_check;

ALTER TABLE public.public_delivery_attempts
  ADD CONSTRAINT public_delivery_attempts_delivery_kind_check CHECK (delivery_kind IN (
    'newsletter_confirmation',
    'public_form_webhook',
    'public_form_email',
    'back_in_stock',
    'order_fulfillment'
  ));

CREATE INDEX IF NOT EXISTS public_delivery_attempts_fulfillment_idx
  ON public.public_delivery_attempts (organization_id, aggregate_id, status)
  WHERE delivery_kind = 'order_fulfillment';
