-- Keep the delivery event ledger and shipment projection atomic.
CREATE OR REPLACE FUNCTION public.append_delivery_logistics_event(
  p_organization_id text,
  p_shipment_id uuid,
  p_event_type text,
  p_event_status text DEFAULT NULL,
  p_event_payload jsonb DEFAULT '{}'::jsonb,
  p_occurred_at timestamptz DEFAULT now(),
  p_created_by_email text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS public.delivery_logistics_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  event_row public.delivery_logistics_events;
  current_status text;
  normalized_event text;
  next_status text;
BEGIN
  IF nullif(trim(p_organization_id), '') IS NULL
     OR nullif(trim(p_event_type), '') IS NULL THEN
    RAISE EXCEPTION 'delivery event organization and type are required';
  END IF;

  IF p_event_payload IS NULL OR jsonb_typeof(p_event_payload) <> 'object' THEN
    RAISE EXCEPTION 'delivery event payload must be an object';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO event_row
    FROM public.delivery_logistics_events
    WHERE organization_id = trim(p_organization_id)
      AND idempotency_key = trim(p_idempotency_key)
    LIMIT 1;
    IF event_row.id IS NOT NULL THEN
      RETURN event_row;
    END IF;
  END IF;

  SELECT status INTO current_status
  FROM public.delivery_logistics_shipments
  WHERE id = p_shipment_id
    AND organization_id = trim(p_organization_id)
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'delivery shipment not found';
  END IF;

  normalized_event := replace(lower(trim(coalesce(p_event_status, ''))), '-', '_');
  IF normalized_event <> '' THEN
    next_status := CASE
      WHEN normalized_event IN ('return_to_sender', 'returned') THEN 'returned'
      WHEN normalized_event = 'dispatch' THEN 'in_transit'
      ELSE normalized_event
    END;
    IF next_status NOT IN ('planned', 'assigned', 'in_transit', 'delivered', 'returned', 'cancelled') THEN
      RAISE EXCEPTION 'unsupported delivery event status: %', p_event_status;
    END IF;
    IF next_status <> current_status AND NOT (
      (current_status = 'planned' AND next_status IN ('assigned', 'cancelled')) OR
      (current_status = 'assigned' AND next_status IN ('in_transit', 'cancelled')) OR
      (current_status = 'in_transit' AND next_status IN ('delivered', 'returned')) OR
      (current_status = 'delivered' AND next_status = 'returned')
    ) THEN
      RAISE EXCEPTION 'invalid delivery transition: % -> %', current_status, next_status;
    END IF;
  END IF;

  INSERT INTO public.delivery_logistics_events (
    shipment_id, organization_id, event_type, event_status, event_payload,
    occurred_at, created_by_email, idempotency_key
  ) VALUES (
    p_shipment_id, trim(p_organization_id), trim(p_event_type),
    nullif(trim(p_event_status), ''), p_event_payload, p_occurred_at,
    nullif(trim(p_created_by_email), ''), nullif(trim(p_idempotency_key), '')
  )
  ON CONFLICT (organization_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL
  DO NOTHING
  RETURNING * INTO event_row;

  IF event_row.id IS NULL AND p_idempotency_key IS NOT NULL THEN
    SELECT * INTO event_row
    FROM public.delivery_logistics_events
    WHERE organization_id = trim(p_organization_id)
      AND idempotency_key = trim(p_idempotency_key)
    LIMIT 1;
    RETURN event_row;
  END IF;

  UPDATE public.delivery_logistics_shipments
  SET last_event_at = p_occurred_at,
      tracking_status = CASE WHEN normalized_event <> '' THEN trim(p_event_status) ELSE tracking_status END,
      status = CASE WHEN normalized_event <> '' THEN next_status ELSE status END,
      updated_by_email = nullif(trim(p_created_by_email), '')
  WHERE id = p_shipment_id
    AND organization_id = trim(p_organization_id);

  RETURN event_row;
END;
$$;

REVOKE ALL ON FUNCTION public.append_delivery_logistics_event(text, uuid, text, text, jsonb, timestamptz, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.append_delivery_logistics_event(text, uuid, text, text, jsonb, timestamptz, text, text) TO service_role;
