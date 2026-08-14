-- Monotonic quote revision for open payment attempts (PRD: quote_version).
ALTER TABLE public.payment_attempts
  ADD COLUMN IF NOT EXISTS quote_version integer NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.payment_attempts.quote_version IS
  'Increments when the stored quote fingerprint changes for this attempt row.';
