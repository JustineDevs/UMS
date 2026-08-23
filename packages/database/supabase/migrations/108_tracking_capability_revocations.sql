CREATE TABLE IF NOT EXISTS public.tracking_capability_revocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  capability_hash text NOT NULL UNIQUE,
  resource_id text NOT NULL,
  revoked_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  revoked_by text,
  reason text,
  CONSTRAINT tracking_capability_revocations_resource_check
    CHECK (resource_id ~ '^(order|cart)_[A-Za-z0-9_-]+$')
);

CREATE INDEX IF NOT EXISTS tracking_capability_revocations_expires_idx
  ON public.tracking_capability_revocations (expires_at);

ALTER TABLE public.tracking_capability_revocations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tracking_capability_revocations FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tracking_capability_revocations TO service_role;
