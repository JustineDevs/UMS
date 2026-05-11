-- PH-23: Enforce medusa_order_id consistency on digital_receipts and pos_voids.
--
-- Rule: any row that carries an order_id reference must also carry the matching
-- medusa_order_id. Rows with no order reference (order_id IS NULL) are exempt
-- (e.g. cash-only POS legacy rows from before Medusa integration).
--
-- Step 1: backfill any remaining NULLs from order_id (same as migration 009).
UPDATE public.digital_receipts
SET medusa_order_id = nullif(trim(order_id), '')
WHERE medusa_order_id IS NULL
  AND order_id IS NOT NULL
  AND trim(order_id) <> '';

UPDATE public.pos_voids
SET medusa_order_id = nullif(trim(order_id), '')
WHERE medusa_order_id IS NULL
  AND order_id IS NOT NULL
  AND trim(order_id) <> '';

-- Step 2: add CHECK constraints so future inserts that supply an order_id must
-- also supply medusa_order_id (prevents accidental regression to NULL linkage).
ALTER TABLE public.digital_receipts
  DROP CONSTRAINT IF EXISTS digital_receipts_medusa_order_id_required;
ALTER TABLE public.digital_receipts
  ADD CONSTRAINT digital_receipts_medusa_order_id_required
  CHECK (
    order_id IS NULL
    OR (medusa_order_id IS NOT NULL AND trim(medusa_order_id) <> '')
  );

ALTER TABLE public.pos_voids
  DROP CONSTRAINT IF EXISTS pos_voids_medusa_order_id_required;
ALTER TABLE public.pos_voids
  ADD CONSTRAINT pos_voids_medusa_order_id_required
  CHECK (
    order_id IS NULL
    OR (medusa_order_id IS NOT NULL AND trim(medusa_order_id) <> '')
  );
