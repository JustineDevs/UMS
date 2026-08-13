CREATE TABLE IF NOT EXISTS public.marketing_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id text,
  email text NOT NULL,
  channel text NOT NULL DEFAULT 'email' CHECK (channel IN ('email')),
  consent_status text NOT NULL DEFAULT 'subscribed' CHECK (consent_status IN ('subscribed', 'unsubscribed')),
  source text NOT NULL DEFAULT 'unknown',
  consented_at timestamptz,
  unsubscribed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, email, channel)
);

CREATE INDEX IF NOT EXISTS marketing_preferences_org_status_idx
  ON public.marketing_preferences (organization_id, consent_status, email);

ALTER TABLE public.marketing_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS marketing_preferences_deny_anon ON public.marketing_preferences;
CREATE POLICY marketing_preferences_deny_anon ON public.marketing_preferences
  FOR ALL TO anon USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS marketing_preferences_deny_authenticated ON public.marketing_preferences;
CREATE POLICY marketing_preferences_deny_authenticated ON public.marketing_preferences
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS marketing_preferences_service_all ON public.marketing_preferences;
CREATE POLICY marketing_preferences_service_all ON public.marketing_preferences
  FOR ALL TO service_role USING (true) WITH CHECK (true);
