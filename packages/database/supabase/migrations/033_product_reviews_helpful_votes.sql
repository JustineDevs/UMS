-- Gap 12: Add helpful_votes to product_reviews.
-- Tracks the number of times authenticated users marked a review as helpful.
-- A separate review_helpful_votes table prevents duplicate votes per user.

ALTER TABLE public.product_reviews
  ADD COLUMN IF NOT EXISTS helpful_votes int NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.review_helpful_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.product_reviews(id) ON DELETE CASCADE,
  medusa_customer_id text,
  voter_ip text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT review_helpful_votes_review_customer_unique
    UNIQUE (review_id, medusa_customer_id)
);

CREATE INDEX IF NOT EXISTS idx_review_helpful_votes_review
  ON public.review_helpful_votes (review_id);

ALTER TABLE public.review_helpful_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS review_helpful_votes_service_role ON public.review_helpful_votes;
CREATE POLICY review_helpful_votes_service_role
  ON public.review_helpful_votes
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.review_helpful_votes IS
  'Tracks which customers voted a review helpful. One vote per customer per review.';
COMMENT ON COLUMN public.product_reviews.helpful_votes IS
  'Denormalized count of helpful votes for fast display. Incremented via service role on vote insert.';
