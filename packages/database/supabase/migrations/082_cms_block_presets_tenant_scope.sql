-- Block presets are reusable CMS data and must not cross organization boundaries.
ALTER TABLE public.cms_page_block_presets
  ADD COLUMN IF NOT EXISTS organization_id text;

DO $$
DECLARE fallback_org text;
BEGIN
  SELECT id INTO fallback_org FROM public.organizations ORDER BY created_at LIMIT 1;
  IF fallback_org IS NOT NULL THEN
    UPDATE public.cms_page_block_presets
    SET organization_id = fallback_org
    WHERE organization_id IS NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS cms_page_block_presets_org_created
  ON public.cms_page_block_presets (organization_id, created_at DESC);
