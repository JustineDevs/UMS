CREATE OR REPLACE FUNCTION public.claim_payment_attempt_for_finalization(p_correlation_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.payment_attempts
  SET finalize_attempts = finalize_attempts + 1,
      status = 'finalizing_order',
      checkout_state = 'finalizing_order',
      updated_at = now()
  WHERE correlation_id = p_correlation_id
    AND medusa_order_id IS NULL
    AND (
      status IN ('initiated', 'paid', 'paid_awaiting_order')
      OR (status = 'finalizing_order' AND updated_at < now() - interval '5 minutes')
    )
  RETURNING true;
$$;

REVOKE ALL ON FUNCTION public.claim_payment_attempt_for_finalization(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_payment_attempt_for_finalization(uuid) TO service_role;
