CREATE TABLE IF NOT EXISTS public.worker_webhook_events (
  provider text NOT NULL,
  event_id text NOT NULL,
  payload jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  processing_error text,
  PRIMARY KEY (provider, event_id)
);

CREATE INDEX IF NOT EXISTS worker_webhook_events_unprocessed_idx
  ON public.worker_webhook_events (received_at)
  WHERE processed_at IS NULL;

ALTER TABLE public.worker_webhook_events ENABLE ROW LEVEL SECURITY;
