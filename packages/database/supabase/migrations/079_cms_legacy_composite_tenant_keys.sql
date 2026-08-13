-- Organization ownership is part of the identity of every mutable legacy CMS record.
ALTER TABLE public.cms_announcement ADD COLUMN IF NOT EXISTS organization_id text;
ALTER TABLE public.cms_form_submissions ADD COLUMN IF NOT EXISTS organization_id text;
ALTER TABLE public.cms_form_settings ADD COLUMN IF NOT EXISTS organization_id text;
ALTER TABLE public.cms_navigation_draft ADD COLUMN IF NOT EXISTS organization_id text;

DO $$
DECLARE fallback_org text;
BEGIN
  SELECT id INTO fallback_org FROM public.organizations ORDER BY created_at LIMIT 1;
  IF fallback_org IS NOT NULL THEN
    UPDATE public.cms_announcement SET organization_id = fallback_org WHERE organization_id IS NULL;
    UPDATE public.cms_form_submissions SET organization_id = fallback_org WHERE organization_id IS NULL;
    UPDATE public.cms_form_settings SET organization_id = fallback_org WHERE organization_id IS NULL;
    UPDATE public.cms_navigation_draft SET organization_id = fallback_org WHERE organization_id IS NULL;
  END IF;
END $$;

ALTER TABLE public.cms_category_content DROP CONSTRAINT IF EXISTS cms_category_content_collection_handle_locale_key;
ALTER TABLE public.cms_blog_posts DROP CONSTRAINT IF EXISTS cms_blog_posts_slug_locale_key;
ALTER TABLE public.cms_redirects DROP CONSTRAINT IF EXISTS cms_redirects_from_path_key;
ALTER TABLE public.cms_announcement DROP CONSTRAINT IF EXISTS cms_announcement_pkey;
ALTER TABLE public.cms_form_settings DROP CONSTRAINT IF EXISTS cms_form_settings_pkey;
ALTER TABLE public.cms_navigation DROP CONSTRAINT IF EXISTS cms_navigation_pkey;
ALTER TABLE public.cms_navigation_draft DROP CONSTRAINT IF EXISTS cms_navigation_draft_pkey;

CREATE UNIQUE INDEX IF NOT EXISTS cms_category_content_org_key ON public.cms_category_content (organization_id, collection_handle, locale);
CREATE UNIQUE INDEX IF NOT EXISTS cms_blog_posts_org_key ON public.cms_blog_posts (organization_id, slug, locale);
CREATE UNIQUE INDEX IF NOT EXISTS cms_redirects_org_key ON public.cms_redirects (organization_id, from_path);
CREATE UNIQUE INDEX IF NOT EXISTS cms_announcement_org_key ON public.cms_announcement (organization_id, id, locale);
CREATE UNIQUE INDEX IF NOT EXISTS cms_form_settings_org_key ON public.cms_form_settings (organization_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS cms_navigation_org_key ON public.cms_navigation (organization_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS cms_navigation_draft_org_key ON public.cms_navigation_draft (organization_id, id);

CREATE INDEX IF NOT EXISTS cms_form_submissions_org_created ON public.cms_form_submissions (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS cms_announcement_org_updated ON public.cms_announcement (organization_id, updated_at DESC);
