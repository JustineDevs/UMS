ALTER TABLE public.cms_pages
  ADD COLUMN IF NOT EXISTS organization_id text;

ALTER TABLE public.cms_pages
  DROP CONSTRAINT IF EXISTS cms_pages_slug_locale_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_cms_pages_organization_slug_locale
  ON public.cms_pages (organization_id, slug, locale);

CREATE INDEX IF NOT EXISTS idx_cms_pages_organization_updated
  ON public.cms_pages (organization_id, updated_at DESC);
