-- Durable webhook verification telemetry used by the payment health endpoint.
CREATE TABLE IF NOT EXISTS public.payment_webhook_security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider IN ('stripe', 'paypal', 'xendit', 'jnt')),
  event_type text NOT NULL CHECK (event_type IN ('signature_failure', 'dedup_duplicate')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_webhook_security_events_recent
  ON public.payment_webhook_security_events (created_at DESC, event_type, provider);

ALTER TABLE public.payment_webhook_security_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access" ON public.payment_webhook_security_events;
CREATE POLICY "service_role_full_access" ON public.payment_webhook_security_events
  FOR ALL USING (auth.role() = 'service_role');
