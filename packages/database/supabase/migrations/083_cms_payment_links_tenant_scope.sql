ALTER TABLE public.cms_payment_links
  ADD COLUMN IF NOT EXISTS organization_id text;

DO $$
DECLARE fallback_org text;
BEGIN
  SELECT id INTO fallback_org FROM public.organizations ORDER BY created_at LIMIT 1;
  IF fallback_org IS NOT NULL THEN
    UPDATE public.cms_payment_links
    SET organization_id = fallback_org
    WHERE organization_id IS NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS cms_payment_links_org_active_sort
  ON public.cms_payment_links (organization_id, active, sort_order, updated_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS cms_payment_links_org_id
  ON public.cms_payment_links (organization_id, id);
