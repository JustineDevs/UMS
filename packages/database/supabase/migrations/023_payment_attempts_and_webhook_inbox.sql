-- Operational payment lifecycle (Medusa remains commerce SoR). Bridge/ledger only.
-- @see internal audit: payment state & reconciliation service

CREATE TABLE IF NOT EXISTS public.payment_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correlation_id uuid NOT NULL UNIQUE,
  cart_id text NOT NULL,
  order_id text,
  provider text NOT NULL,
  provider_session_id text,
  provider_payment_id text,
  status text NOT NULL DEFAULT 'initiated',
  checkout_state text NOT NULL DEFAULT 'awaiting_provider',
  amount_minor bigint,
  currency text,
  medusa_payment_session_id text,
  medusa_payment_id text,
  medusa_order_id text,
  last_error text,
  idempotency_key text,
  provider_payload jsonb NOT NULL DEFAULT '{}',
  webhook_last_event_id text,
  webhook_last_status text,
  finalize_attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  finalized_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_payment_attempts_cart ON public.payment_attempts (cart_id);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_status ON public.payment_attempts (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_open ON public.payment_attempts (status, checkout_state)
  WHERE medusa_order_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS payment_attempts_one_open_per_cart_provider
  ON public.payment_attempts (cart_id, provider)
  WHERE status NOT IN ('completed', 'cancelled', 'expired', 'failed', 'refunded');

CREATE TABLE IF NOT EXISTS public.payment_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  event_id text NOT NULL,
  event_type text,
  payload_hash text,
  payload jsonb NOT NULL DEFAULT '{}',
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  status text NOT NULL DEFAULT 'received',
  processing_error text,
  correlation_id uuid,
  UNIQUE (provider, event_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_webhook_pending ON public.payment_webhook_events (received_at DESC)
  WHERE processed_at IS NULL;

ALTER TABLE public.payment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access" ON public.payment_attempts;
CREATE POLICY "service_role_full_access" ON public.payment_attempts
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "service_role_full_access" ON public.payment_webhook_events;
CREATE POLICY "service_role_full_access" ON public.payment_webhook_events
  FOR ALL USING (auth.role() = 'service_role');
