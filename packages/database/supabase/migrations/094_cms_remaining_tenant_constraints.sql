-- Complete tenant ownership for CMS tables added after the original core scope.
DO $$
DECLARE
  fallback_org text;
BEGIN
  SELECT id INTO fallback_org FROM public.organizations ORDER BY created_at LIMIT 1;
  IF fallback_org IS NULL THEN
    RAISE EXCEPTION 'CMS tenant constraints require at least one organization';
  END IF;

  UPDATE public.cms_ab_experiments SET organization_id = fallback_org WHERE organization_id IS NULL;
  UPDATE public.cms_media SET organization_id = fallback_org WHERE organization_id IS NULL;
  UPDATE public.cms_page_block_presets SET organization_id = fallback_org WHERE organization_id IS NULL;
  UPDATE public.cms_payment_links SET organization_id = fallback_org WHERE organization_id IS NULL;
  UPDATE public.cms_announcement_analytics SET organization_id = fallback_org WHERE organization_id IS NULL;
  UPDATE public.cms_page_mutations SET organization_id = fallback_org WHERE organization_id IS NULL;
END $$;

ALTER TABLE public.cms_ab_experiments ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.cms_media ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.cms_page_block_presets ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.cms_payment_links ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.cms_announcement_analytics ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.cms_page_mutations ALTER COLUMN organization_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS cms_ab_experiments_org_key
  ON public.cms_ab_experiments (organization_id, experiment_key);
CREATE UNIQUE INDEX IF NOT EXISTS cms_media_org_public_url_key
  ON public.cms_media (organization_id, public_url)
  WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS cms_page_block_presets_org_name_key
  ON public.cms_page_block_presets (organization_id, name);
CREATE UNIQUE INDEX IF NOT EXISTS cms_payment_links_org_id_key
  ON public.cms_payment_links (organization_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS cms_announcement_analytics_org_key
  ON public.cms_announcement_analytics (organization_id, announcement_id, locale);

DO $$
DECLARE
  table_name text;
  constraint_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'cms_ab_experiments', 'cms_media', 'cms_page_block_presets',
    'cms_payment_links', 'cms_announcement_analytics', 'cms_page_mutations'
  ] LOOP
    constraint_name := table_name || '_organization_fk';
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = constraint_name
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE',
        table_name, constraint_name
      );
    END IF;
  END LOOP;
END $$;
