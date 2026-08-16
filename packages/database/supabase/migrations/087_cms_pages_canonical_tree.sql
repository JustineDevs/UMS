ALTER TABLE public.cms_pages
  ADD COLUMN IF NOT EXISTS tree jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS cms_pages_tree_gin
  ON public.cms_pages USING gin (tree);
