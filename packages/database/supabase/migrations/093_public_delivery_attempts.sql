CREATE TABLE IF NOT EXISTS public.public_delivery_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id text,
  delivery_kind text NOT NULL CHECK (delivery_kind IN (
    'newsletter_confirmation',
    'public_form_webhook',
    'public_form_email',
    'back_in_stock'
  )),
  aggregate_id text NOT NULL,
  recipient text,
  provider text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  provider_message_id text,
  last_error text,
  attempts integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

CREATE INDEX IF NOT EXISTS public_delivery_attempts_status_idx
  ON public.public_delivery_attempts (delivery_kind, status, created_at);

ALTER TABLE public.public_delivery_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS public_delivery_attempts_anon_deny ON public.public_delivery_attempts;
CREATE POLICY public_delivery_attempts_anon_deny
  ON public.public_delivery_attempts FOR ALL TO anon USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS public_delivery_attempts_authenticated_deny ON public.public_delivery_attempts;
CREATE POLICY public_delivery_attempts_authenticated_deny
  ON public.public_delivery_attempts FOR ALL TO authenticated USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS public_delivery_attempts_service_role ON public.public_delivery_attempts;
CREATE POLICY public_delivery_attempts_service_role
  ON public.public_delivery_attempts FOR ALL TO service_role USING (true) WITH CHECK (true);
