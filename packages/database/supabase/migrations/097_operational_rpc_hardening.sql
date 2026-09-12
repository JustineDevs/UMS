-- Harden operational RPC boundaries and make canonical previous-state capture explicit.
CREATE OR REPLACE FUNCTION public.append_canonical_order_state(
  p_organization_id text,
  p_medusa_order_id text,
  p_status text,
  p_event_type text,
  p_source text,
  p_idempotency_key text,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_occurred_at timestamptz DEFAULT now()
)
RETURNS public.canonical_order_state_ledger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  previous public.canonical_order_state_ledger%ROWTYPE;
  existing public.canonical_order_state_ledger%ROWTYPE;
  inserted public.canonical_order_state_ledger%ROWTYPE;
  has_previous boolean := false;
BEGIN
  SELECT * INTO existing FROM public.canonical_order_state_ledger
  WHERE organization_id = trim(p_organization_id)
    AND medusa_order_id = trim(p_medusa_order_id)
    AND idempotency_key = trim(p_idempotency_key);
  IF FOUND THEN RETURN existing; END IF;

  SELECT * INTO previous FROM public.canonical_order_state_ledger
  WHERE organization_id = trim(p_organization_id)
    AND medusa_order_id = trim(p_medusa_order_id)
  ORDER BY occurred_at DESC, created_at DESC
  LIMIT 1 FOR UPDATE;
  has_previous := FOUND;

  IF has_previous AND previous.status <> p_status AND NOT (
    (previous.status = 'pending' AND p_status IN ('paid','cancelled','failed')) OR
    (previous.status = 'paid' AND p_status IN ('processing','cancelled','refunded')) OR
    (previous.status = 'processing' AND p_status IN ('packed','cancelled','refunded')) OR
    (previous.status = 'packed' AND p_status IN ('shipped','cancelled')) OR
    (previous.status = 'shipped' AND p_status IN ('delivered','returned')) OR
    (previous.status = 'delivered' AND p_status IN ('returned','refunded')) OR
    (previous.status = 'returned' AND p_status = 'refunded') OR
    (previous.status = 'failed' AND p_status IN ('pending','cancelled'))
  ) THEN
    RAISE EXCEPTION 'invalid canonical order transition: % -> %', previous.status, p_status;
  END IF;

  INSERT INTO public.canonical_order_state_ledger (
    organization_id, medusa_order_id, status, previous_status, event_type, source,
    idempotency_key, metadata, occurred_at
  ) VALUES (
    trim(p_organization_id), trim(p_medusa_order_id), p_status,
    CASE WHEN has_previous THEN previous.status ELSE NULL END,
    trim(p_event_type), trim(p_source), trim(p_idempotency_key),
    coalesce(p_metadata, '{}'::jsonb), p_occurred_at
  ) RETURNING * INTO inserted;
  RETURN inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.inventory_reservation_expire(text, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inventory_reservation_set_expiry(text, uuid, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inventory_reservation_expire_due(text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.append_canonical_order_state(text, text, text, text, text, text, jsonb, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.inventory_reservation_expire(text, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.inventory_reservation_set_expiry(text, uuid, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.inventory_reservation_expire_due(text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.append_canonical_order_state(text, text, text, text, text, text, jsonb, timestamptz) TO service_role;
