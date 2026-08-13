ALTER TABLE public.cms_announcement_analytics ADD COLUMN IF NOT EXISTS organization_id text;

DO $$
DECLARE fallback_org text;
BEGIN
  SELECT id INTO fallback_org FROM public.organizations ORDER BY created_at LIMIT 1;
  IF fallback_org IS NOT NULL THEN
    UPDATE public.cms_announcement_analytics
    SET organization_id = fallback_org
    WHERE organization_id IS NULL;
  END IF;
END $$;

ALTER TABLE public.cms_announcement_analytics DROP CONSTRAINT IF EXISTS cms_announcement_analytics_pkey;
CREATE UNIQUE INDEX IF NOT EXISTS cms_announcement_analytics_org_key
  ON public.cms_announcement_analytics (organization_id, announcement_id, locale);
CREATE INDEX IF NOT EXISTS cms_announcement_analytics_org_updated
  ON public.cms_announcement_analytics (organization_id, updated_at DESC);
