-- Invoice artifacts are provider lifecycle records, not local invoice payloads.
alter table public.payment_provider_artifacts
  drop constraint if exists payment_provider_artifacts_artifact_type_check;

alter table public.payment_provider_artifacts
  add constraint payment_provider_artifacts_artifact_type_check
  check (artifact_type in (
    'product', 'price', 'payment_link', 'invoice', 'checkout_session',
    'payment_intent', 'payment_request', 'payment_token', 'authorization',
    'capture', 'refund', 'dispute', 'payout', 'reconciliation'
  ));
