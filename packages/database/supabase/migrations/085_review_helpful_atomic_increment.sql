-- Keep the denormalized helpful count correct when concurrent votes arrive.
CREATE OR REPLACE FUNCTION public.increment_review_helpful_votes(review_uuid uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.product_reviews
  SET helpful_votes = helpful_votes + 1
  WHERE id = review_uuid
  RETURNING helpful_votes;
$$;

REVOKE ALL ON FUNCTION public.increment_review_helpful_votes(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_review_helpful_votes(uuid) TO service_role;
