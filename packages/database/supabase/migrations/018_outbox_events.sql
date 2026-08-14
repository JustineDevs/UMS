CREATE TABLE IF NOT EXISTS public.outbox_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_type text NOT NULL,
  aggregate_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  retry_count integer NOT NULL DEFAULT 0,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outbox_pending ON public.outbox_events (created_at)
  WHERE processed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_outbox_aggregate ON public.outbox_events (aggregate_type, aggregate_id);

ALTER TABLE public.outbox_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access" ON public.outbox_events;
CREATE POLICY "service_role_full_access" ON public.outbox_events
  FOR ALL USING (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION public.increment_outbox_retry(event_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE public.outbox_events
  SET retry_count = retry_count + 1
  WHERE id = event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
