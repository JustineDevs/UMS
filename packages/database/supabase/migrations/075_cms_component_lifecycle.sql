CREATE TABLE IF NOT EXISTS public.cms_component_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id text NOT NULL,
  component_key text NOT NULL,
  definition jsonb NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  created_by text,
  updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, component_key)
);

CREATE TABLE IF NOT EXISTS public.cms_component_definition_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  definition_id uuid NOT NULL REFERENCES public.cms_component_definitions(id) ON DELETE CASCADE,
  organization_id text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  definition jsonb NOT NULL,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (definition_id, version)
);

CREATE INDEX IF NOT EXISTS idx_cms_component_definitions_org
  ON public.cms_component_definitions (organization_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_cms_component_definition_versions_definition
  ON public.cms_component_definition_versions (definition_id, version DESC);

ALTER TABLE public.cms_component_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_component_definition_versions ENABLE ROW LEVEL SECURITY;
