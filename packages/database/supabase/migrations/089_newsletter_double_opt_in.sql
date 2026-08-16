CREATE TABLE IF NOT EXISTS public.newsletter_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id text,
  email text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS newsletter_confirmations_email_idx
  ON public.newsletter_confirmations (organization_id, email, expires_at);

ALTER TABLE public.newsletter_confirmations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS newsletter_confirmations_deny_anon ON public.newsletter_confirmations;
CREATE POLICY newsletter_confirmations_deny_anon ON public.newsletter_confirmations
  FOR ALL TO anon USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS newsletter_confirmations_deny_authenticated ON public.newsletter_confirmations;
CREATE POLICY newsletter_confirmations_deny_authenticated ON public.newsletter_confirmations
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS newsletter_confirmations_service_all ON public.newsletter_confirmations;
CREATE POLICY newsletter_confirmations_service_all ON public.newsletter_confirmations
  FOR ALL TO service_role USING (true) WITH CHECK (true);
