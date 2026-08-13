ALTER TABLE public.payment_attempts
  ADD COLUMN IF NOT EXISTS organization_id text
  REFERENCES public.organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payment_attempts_organization_updated
  ON public.payment_attempts (organization_id, updated_at DESC);
