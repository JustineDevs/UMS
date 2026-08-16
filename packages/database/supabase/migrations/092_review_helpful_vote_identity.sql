-- Keep anonymous helpful votes unique by the request identity as well as by customer.
-- The existing customer constraint permits duplicate NULL customer ids.
ALTER TABLE public.review_helpful_votes
  DROP CONSTRAINT IF EXISTS review_helpful_votes_review_customer_unique;

ALTER TABLE public.review_helpful_votes
  ADD CONSTRAINT review_helpful_votes_review_customer_unique
  UNIQUE (review_id, medusa_customer_id);

ALTER TABLE public.review_helpful_votes
  ADD CONSTRAINT review_helpful_votes_review_ip_unique
  UNIQUE (review_id, voter_ip);

CREATE OR REPLACE FUNCTION public.record_review_helpful_vote(
  review_uuid uuid,
  customer_id text,
  request_ip text
)
RETURNS TABLE(inserted boolean, helpful_votes integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_count integer;
BEGIN
  INSERT INTO public.review_helpful_votes (review_id, medusa_customer_id, voter_ip)
  VALUES (review_uuid, customer_id, request_ip)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS inserted_count = ROW_COUNT;

  IF inserted_count = 1 THEN
    UPDATE public.product_reviews
    SET helpful_votes = helpful_votes + 1
    WHERE id = review_uuid;
  END IF;

  RETURN QUERY
    SELECT inserted_count = 1, pr.helpful_votes
    FROM public.product_reviews AS pr
    WHERE pr.id = review_uuid;
END;
$$;

REVOKE ALL ON FUNCTION public.record_review_helpful_vote(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_review_helpful_vote(uuid, text, text) TO service_role;
