/**
 * Canonical outbox `event_type` strings for payment lifecycle (use with `enqueueOutboxEvent`).
 */
export const PAYMENT_OUTBOX_EVENT_TYPES = {
  PAYMENT_ATTEMPT_CREATED: "payment_attempt.created",
  PAYMENT_ATTEMPT_PAID: "payment_attempt.paid",
  PAYMENT_ATTEMPT_NEEDS_REVIEW: "payment_attempt.needs_review",
  PAYMENT_ATTEMPT_FINALIZE_REQUESTED: "payment_attempt.finalize_requested",
  PAYMENT_ATTEMPT_REFUND_REQUESTED: "payment_attempt.refund_requested",
  PAYMENT_ATTEMPT_COD_CAPTURE_REQUESTED: "payment_attempt.cod_capture_requested",
} as const;
