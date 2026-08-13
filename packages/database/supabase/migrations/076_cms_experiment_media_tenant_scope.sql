ALTER TABLE public.cms_ab_experiments
  ADD COLUMN IF NOT EXISTS organization_id text;

ALTER TABLE public.cms_ab_experiments
  DROP CONSTRAINT IF EXISTS cms_ab_experiments_experiment_key_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_cms_ab_experiments_org_key
  ON public.cms_ab_experiments (organization_id, experiment_key);
CREATE INDEX IF NOT EXISTS idx_cms_ab_experiments_org_updated
  ON public.cms_ab_experiments (organization_id, updated_at DESC);

ALTER TABLE public.cms_media
  ADD COLUMN IF NOT EXISTS organization_id text;
CREATE INDEX IF NOT EXISTS idx_cms_media_org_created
  ON public.cms_media (organization_id, created_at DESC);
