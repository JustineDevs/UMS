-- Persist the reusable definition and its immutable version snapshot atomically.
CREATE OR REPLACE FUNCTION public.save_cms_component_definition(
  p_organization_id text,
  p_component_key text,
  p_definition jsonb,
  p_expected_version integer DEFAULT NULL,
  p_actor_id text DEFAULT NULL
)
RETURNS public.cms_component_definitions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_row public.cms_component_definitions%ROWTYPE;
  saved_row public.cms_component_definitions%ROWTYPE;
  next_version integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_organization_id || ':' || p_component_key));
  SELECT * INTO current_row
  FROM public.cms_component_definitions
  WHERE organization_id = p_organization_id
    AND component_key = p_component_key
  FOR UPDATE;

  IF p_expected_version IS NOT NULL
     AND (current_row.id IS NULL OR current_row.version <> p_expected_version) THEN
    RAISE EXCEPTION 'COMPONENT_VERSION_CONFLICT' USING ERRCODE = 'P0001';
  END IF;

  next_version := COALESCE(current_row.version, 0) + 1;
  IF current_row.id IS NULL THEN
    INSERT INTO public.cms_component_definitions (
      organization_id, component_key, definition, version, status, created_by, updated_by
    ) VALUES (
      p_organization_id, p_component_key, p_definition, next_version, 'draft', p_actor_id, p_actor_id
    ) RETURNING * INTO saved_row;
  ELSE
    UPDATE public.cms_component_definitions
    SET definition = p_definition,
        version = next_version,
        updated_by = p_actor_id,
        updated_at = now()
    WHERE id = current_row.id
    RETURNING * INTO saved_row;
  END IF;

  INSERT INTO public.cms_component_definition_versions (
    definition_id, organization_id, version, definition, created_by
  ) VALUES (
    saved_row.id, saved_row.organization_id, saved_row.version, saved_row.definition, p_actor_id
  );

  RETURN saved_row;
END;
$$;

REVOKE ALL ON FUNCTION public.save_cms_component_definition(text, text, jsonb, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_cms_component_definition(text, text, jsonb, integer, text) TO service_role;
