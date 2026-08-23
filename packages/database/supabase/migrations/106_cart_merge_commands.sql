-- Serialize guest-cart merges across stateless storefront instances.
CREATE TABLE IF NOT EXISTS public.cart_merge_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id text NOT NULL,
  merge_key text NOT NULL,
  owner_key text NOT NULL,
  status text NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'completed', 'expired')),
  response jsonb,
  locked_until timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cart_id, merge_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS cart_merge_commands_active_cart
  ON public.cart_merge_commands (cart_id)
  WHERE status = 'in_progress';

ALTER TABLE public.cart_merge_commands ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cart_merge_commands_deny_anon ON public.cart_merge_commands;
CREATE POLICY cart_merge_commands_deny_anon
  ON public.cart_merge_commands FOR ALL TO anon USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS cart_merge_commands_deny_authenticated ON public.cart_merge_commands;
CREATE POLICY cart_merge_commands_deny_authenticated
  ON public.cart_merge_commands FOR ALL TO authenticated USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS cart_merge_commands_service_all ON public.cart_merge_commands;
CREATE POLICY cart_merge_commands_service_all
  ON public.cart_merge_commands FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.claim_cart_merge(
  p_cart_id text,
  p_merge_key text,
  p_owner_key text,
  p_lock_seconds integer DEFAULT 90
)
RETURNS TABLE(acquired boolean, replayed boolean, response jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  existing public.cart_merge_commands%ROWTYPE;
  lock_until timestamptz := now() + make_interval(secs => greatest(15, least(coalesce(p_lock_seconds, 90), 600)));
BEGIN
  IF nullif(trim(p_cart_id), '') IS NULL OR nullif(trim(p_merge_key), '') IS NULL OR nullif(trim(p_owner_key), '') IS NULL THEN
    RAISE EXCEPTION 'cart_id, merge_key, and owner_key are required';
  END IF;

  SELECT * INTO existing
    FROM public.cart_merge_commands
   WHERE cart_id = trim(p_cart_id) AND merge_key = trim(p_merge_key)
   FOR UPDATE;

  IF found AND existing.status = 'completed' THEN
    RETURN QUERY SELECT false, true, existing.response;
    RETURN;
  END IF;

  IF found AND existing.status = 'in_progress' AND existing.locked_until > now() THEN
    RETURN QUERY SELECT false, false, NULL::jsonb;
    RETURN;
  END IF;

  IF found THEN
    UPDATE public.cart_merge_commands
       SET owner_key = trim(p_owner_key), status = 'in_progress', response = NULL,
           locked_until = lock_until, updated_at = now()
     WHERE id = existing.id;
  ELSE
    IF EXISTS (
      SELECT 1 FROM public.cart_merge_commands
       WHERE cart_id = trim(p_cart_id) AND status = 'in_progress' AND locked_until > now()
    ) THEN
      RETURN QUERY SELECT false, false, NULL::jsonb;
      RETURN;
    END IF;
    BEGIN
      INSERT INTO public.cart_merge_commands (cart_id, merge_key, owner_key, locked_until)
      VALUES (trim(p_cart_id), trim(p_merge_key), trim(p_owner_key), lock_until);
    EXCEPTION WHEN unique_violation THEN
      -- A concurrent request either owns this cart or completed this exact key.
      SELECT * INTO existing
        FROM public.cart_merge_commands
       WHERE cart_id = trim(p_cart_id) AND merge_key = trim(p_merge_key)
       FOR UPDATE;
      IF found AND existing.status = 'completed' THEN
        RETURN QUERY SELECT false, true, existing.response;
      ELSE
        RETURN QUERY SELECT false, false, NULL::jsonb;
      END IF;
      RETURN;
    END;
  END IF;

  RETURN QUERY SELECT true, false, NULL::jsonb;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_cart_merge(
  p_cart_id text,
  p_merge_key text,
  p_owner_key text,
  p_response jsonb
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.cart_merge_commands
     SET status = 'completed', response = p_response, locked_until = now(), updated_at = now()
   WHERE cart_id = trim(p_cart_id) AND merge_key = trim(p_merge_key)
     AND owner_key = trim(p_owner_key) AND status = 'in_progress';
  RETURN found;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_cart_merge(
  p_cart_id text,
  p_merge_key text,
  p_owner_key text
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.cart_merge_commands
     SET status = 'expired', locked_until = now(), updated_at = now()
   WHERE cart_id = trim(p_cart_id) AND merge_key = trim(p_merge_key)
     AND owner_key = trim(p_owner_key) AND status = 'in_progress';
  RETURN found;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_cart_merge(text, text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_cart_merge(text, text, text, integer) TO service_role;
REVOKE ALL ON FUNCTION public.complete_cart_merge(text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_cart_merge(text, text, text, jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.release_cart_merge(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_cart_merge(text, text, text) TO service_role;
