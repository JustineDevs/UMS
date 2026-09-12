-- Keep editorial category content attached to the Medusa category identity.
ALTER TABLE public.cms_category_content
  ADD COLUMN IF NOT EXISTS collection_id text;

CREATE INDEX IF NOT EXISTS idx_cms_category_content_canonical
  ON public.cms_category_content (organization_id, collection_id, locale)
  WHERE collection_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS cms_category_content_org_collection_id_locale_key
  ON public.cms_category_content (organization_id, collection_id, locale)
  WHERE collection_id IS NOT NULL;
