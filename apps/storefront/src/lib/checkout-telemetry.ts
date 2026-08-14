/**
 * Structured logs for order-completion stages (audit: instrument order completion failures).
 * Parse with log aggregators using JSON lines or filter `checkout_completion` in stdout.
 */

export type CheckoutCompletionPayload = {
  stage: "complete_medusa_cart" | "cod_place_order";
  outcome: "success" | "failure";
  httpStatus?: number;
  cartIdSuffix?: string;
  orderId?: string;
  attempts?: number;
  errorCode?: string;
  message?: string;
};

export function logCheckoutCompletionEvent(payload: CheckoutCompletionPayload): void {
  const line = JSON.stringify({
    event: "checkout_completion",
    ts: new Date().toISOString(),
    ...payload,
  });
  console.info(line);
}
