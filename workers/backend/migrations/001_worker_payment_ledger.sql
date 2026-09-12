-- Worker-owned operational state. Commerce entities remain the existing
-- PostgreSQL order/cart/catalog tables; this migration only moves the
-- payment/replay inbox required by Worker-native checkout.

CREATE TABLE IF NOT EXISTS public.worker_schema_migrations (
  filename text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.worker_idempotency_records (
  idempotency_key text PRIMARY KEY,
  request_hash text NOT NULL,
  state text NOT NULL DEFAULT 'completed'
    CHECK (state IN ('pending', 'completed')),
  response_status integer NOT NULL CHECK (response_status BETWEEN 100 AND 599),
  response_headers jsonb NOT NULL DEFAULT '[]'::jsonb,
  response_body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS worker_idempotency_records_expires_at_idx
  ON public.worker_idempotency_records (expires_at);

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
  provider_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  webhook_last_event_id text,
  webhook_last_status text,
  finalize_attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  finalized_at timestamptz
);

CREATE INDEX IF NOT EXISTS worker_payment_attempts_cart_idx
  ON public.payment_attempts (cart_id);
CREATE INDEX IF NOT EXISTS worker_payment_attempts_status_idx
  ON public.payment_attempts (status, updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS worker_payment_attempts_idempotency_idx
  ON public.payment_attempts (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.payment_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  event_id text NOT NULL,
  event_type text,
  payload_hash text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  status text NOT NULL DEFAULT 'received',
  processing_error text,
  correlation_id uuid,
  UNIQUE (provider, event_id)
);

CREATE INDEX IF NOT EXISTS worker_payment_webhook_pending_idx
  ON public.payment_webhook_events (received_at DESC)
  WHERE processed_at IS NULL;

ALTER TABLE public.worker_idempotency_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.payment_attempts IS
  'Worker-native payment lifecycle ledger; provider callbacks are verified before state changes.';
