-- Keep CMS records isolated when more than one organization shares the database.
ALTER TABLE public.cms_category_content
  ADD COLUMN IF NOT EXISTS organization_id text;
ALTER TABLE public.cms_blog_posts
  ADD COLUMN IF NOT EXISTS organization_id text;
ALTER TABLE public.cms_navigation
  ADD COLUMN IF NOT EXISTS organization_id text;
ALTER TABLE public.cms_redirects
  ADD COLUMN IF NOT EXISTS organization_id text;

DO $$
DECLARE
  fallback_org text;
BEGIN
  SELECT id INTO fallback_org FROM public.organizations ORDER BY created_at LIMIT 1;
  IF fallback_org IS NOT NULL THEN
    UPDATE public.cms_category_content SET organization_id = fallback_org WHERE organization_id IS NULL;
    UPDATE public.cms_blog_posts SET organization_id = fallback_org WHERE organization_id IS NULL;
    UPDATE public.cms_navigation SET organization_id = fallback_org WHERE organization_id IS NULL;
    UPDATE public.cms_redirects SET organization_id = fallback_org WHERE organization_id IS NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_cms_category_content_org
  ON public.cms_category_content (organization_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_cms_blog_posts_org
  ON public.cms_blog_posts (organization_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_cms_navigation_org
  ON public.cms_navigation (organization_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_cms_redirects_org
  ON public.cms_redirects (organization_id, created_at DESC);
