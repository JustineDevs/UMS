-- D-34/D-41: durable notification outcomes and privacy retention metadata.
UPDATE public.public_delivery_attempts SET status = 'queued' WHERE status = 'pending';
ALTER TABLE public.public_delivery_attempts
  DROP CONSTRAINT IF EXISTS public_delivery_attempts_status_check;
ALTER TABLE public.public_delivery_attempts
  ADD CONSTRAINT public_delivery_attempts_status_check CHECK (status IN (
    'queued', 'sent', 'bounced', 'failed', 'suppressed', 'retry', 'unsubscribe'
  ));
ALTER TABLE public.public_delivery_attempts
  ALTER COLUMN status SET DEFAULT 'queued',
  ADD COLUMN IF NOT EXISTS suppression_reason text,
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz;
CREATE INDEX IF NOT EXISTS public_delivery_attempts_retry_idx
  ON public.public_delivery_attempts (status, next_attempt_at) WHERE status = 'retry';
CREATE INDEX IF NOT EXISTS back_in_stock_email_idx
  ON public.back_in_stock_notifications (email);
