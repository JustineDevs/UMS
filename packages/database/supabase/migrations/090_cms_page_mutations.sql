CREATE TABLE IF NOT EXISTS public.cms_page_mutations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL REFERENCES public.cms_pages(id) ON DELETE CASCADE,
  organization_id text,
  revision integer NOT NULL CHECK (revision > 0),
  sequence integer NOT NULL CHECK (sequence >= 0),
  mutation jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (page_id, revision, sequence)
);

CREATE INDEX IF NOT EXISTS cms_page_mutations_org_revision
  ON public.cms_page_mutations (organization_id, page_id, revision DESC);

ALTER TABLE public.cms_page_mutations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cms_page_mutations_deny_anon ON public.cms_page_mutations;
CREATE POLICY cms_page_mutations_deny_anon ON public.cms_page_mutations
  FOR ALL TO anon USING (false) WITH CHECK (false);
