-- Bring legacy POS and payment-ledger tables under the same tenant boundary as their readers.
ALTER TABLE public.pos_devices
  ADD COLUMN IF NOT EXISTS organization_id text;

ALTER TABLE public.payment_attempts
  ADD COLUMN IF NOT EXISTS organization_id text;

UPDATE public.pos_devices
SET organization_id = (SELECT id FROM public.organizations ORDER BY created_at LIMIT 1)
WHERE organization_id IS NULL;

UPDATE public.payment_attempts
SET organization_id = (SELECT id FROM public.organizations ORDER BY created_at LIMIT 1)
WHERE organization_id IS NULL;

CREATE INDEX IF NOT EXISTS pos_devices_organization_idx
  ON public.pos_devices (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS payment_attempts_organization_idx
  ON public.payment_attempts (organization_id, updated_at DESC);
