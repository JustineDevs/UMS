-- Transaction-local replay protection for commerce mutations.
-- This is deliberately limited to the idempotency ledger: commerce entities
-- remain Medusa-owned and the platform ledger remains APP_DB-owned.
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
