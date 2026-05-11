-- PH-24: Idempotency constraint for cart abandonment recovery emails.
--
-- Prevents two concurrent requests from sending two recovery emails to the
-- same address within the same 48-hour send window. The policy is:
-- at most one recovery email per (lowercase email, UTC calendar day).
-- A partial unique index on a derived expression is not directly possible in
-- Postgres without a function index, so we use a generated column approach:
-- store the "send day" as a date column populated by trigger, then add a
-- partial unique index on (email, recovery_window_day) where
-- recovery_email_sent_at IS NOT NULL.
--
-- Alternatively (simpler and safer for concurrent inserts):
-- Add a dedicated dedup log table with a primary key on
-- (lower(email), date_trunc('day', ...)).
-- We use the log table pattern to avoid altering the hot inserts path.

CREATE TABLE IF NOT EXISTS public.cart_recovery_send_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  window_day date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cart_recovery_send_log_email_day_unique UNIQUE (email, window_day)
);

COMMENT ON TABLE public.cart_recovery_send_log IS
  'Dedup log for cart abandonment recovery emails. One row per (email, calendar day UTC). '
  'Insert this row (or catch unique violation) before sending to prevent duplicate sends '
  'under concurrent requests.';

CREATE INDEX IF NOT EXISTS idx_cart_recovery_send_log_email
  ON public.cart_recovery_send_log (email, window_day);

ALTER TABLE public.cart_recovery_send_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cart_recovery_send_log_service_role ON public.cart_recovery_send_log;
CREATE POLICY cart_recovery_send_log_service_role
  ON public.cart_recovery_send_log
  TO service_role
  USING (true)
  WITH CHECK (true);
