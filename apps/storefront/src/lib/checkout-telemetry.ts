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
  const { cartIdSuffix, orderId, ...safePayload } = payload;
  const line = JSON.stringify({
    event: "checkout_completion",
    ts: new Date().toISOString(),
    cart_id_present: Boolean(cartIdSuffix),
    order_id_present: Boolean(orderId),
    ...safePayload,
  });
  console.info(line);
}
