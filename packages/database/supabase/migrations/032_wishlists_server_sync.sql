-- Gap 10: Server-side wishlist storage keyed by Medusa customer id.
-- Local localStorage wishlist is merged into this table on first login.
--
-- Design: one row per (customer + product). This enables:
--   - Multi-device sync after login
--   - Server-side rendering of wishlist counts
--   - Future notifications when saved items go on sale

CREATE TABLE IF NOT EXISTS public.wishlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medusa_customer_id text NOT NULL,
  product_slug text NOT NULL,
  product_name text NOT NULL,
  medusa_product_id text,
  added_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wishlists_customer_product_unique
    UNIQUE (medusa_customer_id, product_slug)
);

COMMENT ON TABLE public.wishlists IS
  'Server-side wishlist entries. Source of truth after login; localStorage merged on first sign-in.';

CREATE INDEX IF NOT EXISTS idx_wishlists_customer
  ON public.wishlists (medusa_customer_id, added_at DESC);

CREATE INDEX IF NOT EXISTS idx_wishlists_product
  ON public.wishlists (product_slug);

ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;

-- Service role has full access; app-layer NextAuth session guard enforces user scoping.
DROP POLICY IF EXISTS wishlists_service_role ON public.wishlists;
CREATE POLICY wishlists_service_role
  ON public.wishlists
  TO service_role
  USING (true)
  WITH CHECK (true);
