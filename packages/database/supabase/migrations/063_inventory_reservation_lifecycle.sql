CREATE TABLE IF NOT EXISTS public.inventory_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  location_id text NOT NULL,
  inventory_item_id text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'released', 'committed')),
  idempotency_key text NOT NULL,
  release_idempotency_key text,
  commit_idempotency_key text,
  attach_idempotency_key text,
  close_idempotency_key text,
  medusa_reservation_id text,
  medusa_closed_at timestamptz,
  reference_type text,
  reference_id text,
  metadata jsonb NOT NULL DEFAULT '{}',
  reserved_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz,
  committed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_reservations_tenant_idempotency
  ON public.inventory_reservations (tenant_id, idempotency_key);
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_reservations_tenant_release_idempotency
  ON public.inventory_reservations (tenant_id, release_idempotency_key)
  WHERE release_idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_reservations_tenant_commit_idempotency
  ON public.inventory_reservations (tenant_id, commit_idempotency_key)
  WHERE commit_idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_reservations_tenant_attach_idempotency
  ON public.inventory_reservations (tenant_id, attach_idempotency_key)
  WHERE attach_idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_reservations_tenant_close_idempotency
  ON public.inventory_reservations (tenant_id, close_idempotency_key)
  WHERE close_idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_reservations_active_item_location
  ON public.inventory_reservations (tenant_id, location_id, inventory_item_id)
  WHERE status = 'active';

ALTER TABLE public.inventory_reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inventory_reservations_service_role ON public.inventory_reservations;
CREATE POLICY inventory_reservations_service_role ON public.inventory_reservations
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS inventory_reservations_deny_anon ON public.inventory_reservations;
CREATE POLICY inventory_reservations_deny_anon ON public.inventory_reservations
  FOR ALL TO anon USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS inventory_reservations_deny_authenticated ON public.inventory_reservations;
CREATE POLICY inventory_reservations_deny_authenticated ON public.inventory_reservations
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.inventory_reservation_lifecycle(
  p_operation text,
  p_tenant_id text,
  p_idempotency_key text,
  p_reservation_id uuid DEFAULT NULL,
  p_location_id text DEFAULT NULL,
  p_inventory_item_id text DEFAULT NULL,
  p_quantity integer DEFAULT NULL,
  p_available_quantity integer DEFAULT NULL,
  p_medusa_reservation_id text DEFAULT NULL,
  p_reference_type text DEFAULT NULL,
  p_reference_id text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS public.inventory_reservations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing public.inventory_reservations%ROWTYPE;
  target public.inventory_reservations%ROWTYPE;
  active_reserved integer;
BEGIN
  IF nullif(trim(p_tenant_id), '') IS NULL THEN
    RAISE EXCEPTION 'tenant_id is required';
  END IF;
  IF nullif(trim(p_idempotency_key), '') IS NULL THEN
    RAISE EXCEPTION 'idempotency_key is required';
  END IF;

  SELECT * INTO existing
  FROM public.inventory_reservations
  WHERE tenant_id = trim(p_tenant_id)
    AND (
      (p_operation = 'reserve' AND idempotency_key = trim(p_idempotency_key))
      OR (p_operation = 'release' AND release_idempotency_key = trim(p_idempotency_key))
      OR (p_operation = 'commit' AND commit_idempotency_key = trim(p_idempotency_key))
      OR (p_operation = 'attach_medusa' AND attach_idempotency_key = trim(p_idempotency_key))
      OR (p_operation = 'close_medusa' AND close_idempotency_key = trim(p_idempotency_key))
    );
  IF FOUND THEN
    RETURN existing;
  END IF;

  IF p_operation = 'reserve' THEN
    IF nullif(trim(coalesce(p_location_id, '')), '') IS NULL THEN
      RAISE EXCEPTION 'location_id is required';
    END IF;
    IF nullif(trim(coalesce(p_inventory_item_id, '')), '') IS NULL THEN
      RAISE EXCEPTION 'inventory_item_id is required';
    END IF;
    IF coalesce(p_quantity, 0) <= 0 THEN
      RAISE EXCEPTION 'quantity must be positive';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(
      trim(p_tenant_id) || ':' || trim(p_location_id) || ':' || trim(p_inventory_item_id),
      0
    ));

    SELECT coalesce(sum(quantity), 0) INTO active_reserved
    FROM public.inventory_reservations
    WHERE tenant_id = trim(p_tenant_id)
      AND location_id = trim(p_location_id)
      AND inventory_item_id = trim(p_inventory_item_id)
      AND status = 'active';

    IF active_reserved + p_quantity > coalesce(p_available_quantity, 0) THEN
      RAISE EXCEPTION 'insufficient inventory';
    END IF;

    INSERT INTO public.inventory_reservations (
      tenant_id,
      location_id,
      inventory_item_id,
      quantity,
      status,
      idempotency_key,
      reference_type,
      reference_id,
      metadata
    )
    VALUES (
      trim(p_tenant_id),
      trim(p_location_id),
      trim(p_inventory_item_id),
      p_quantity,
      'active',
      trim(p_idempotency_key),
      nullif(trim(coalesce(p_reference_type, '')), ''),
      nullif(trim(coalesce(p_reference_id, '')), ''),
      coalesce(p_metadata, '{}'::jsonb)
    )
    RETURNING * INTO target;
    RETURN target;
  END IF;

  IF p_reservation_id IS NULL THEN
    RAISE EXCEPTION 'reservation_id is required';
  END IF;

  SELECT * INTO target
  FROM public.inventory_reservations
  WHERE id = p_reservation_id
    AND tenant_id = trim(p_tenant_id)
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'reservation not found';
  END IF;

  IF p_operation = 'attach_medusa' THEN
    UPDATE public.inventory_reservations
    SET medusa_reservation_id = nullif(trim(coalesce(p_medusa_reservation_id, '')), ''),
        attach_idempotency_key = trim(p_idempotency_key),
        updated_at = now()
    WHERE id = target.id
      AND status = 'active'
    RETURNING * INTO target;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'reservation is already %', target.status;
    END IF;
    RETURN target;
  END IF;

  IF p_operation = 'close_medusa' THEN
    UPDATE public.inventory_reservations
    SET medusa_closed_at = coalesce(medusa_closed_at, now()),
        close_idempotency_key = trim(p_idempotency_key),
        updated_at = now()
    WHERE id = target.id
      AND status IN ('released', 'committed')
    RETURNING * INTO target;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'reservation must be released or committed before closing Medusa reservation';
    END IF;
    RETURN target;
  END IF;

  IF target.status <> 'active' THEN
    RAISE EXCEPTION 'reservation is already %', target.status;
  END IF;

  IF p_operation = 'release' THEN
    UPDATE public.inventory_reservations
    SET status = 'released',
        released_at = now(),
        release_idempotency_key = trim(p_idempotency_key),
        updated_at = now()
    WHERE id = target.id
    RETURNING * INTO target;
    RETURN target;
  END IF;

  IF p_operation = 'commit' THEN
    UPDATE public.inventory_reservations
    SET status = 'committed',
        committed_at = now(),
        commit_idempotency_key = trim(p_idempotency_key),
        updated_at = now()
    WHERE id = target.id
    RETURNING * INTO target;
    RETURN target;
  END IF;

  RAISE EXCEPTION 'unsupported inventory reservation operation %', p_operation;
END;
$$;
