export type PaymentCheckoutState =
  | "awaiting_provider"
  | "provider_verified"
  | "finalizing_order"
  | "awaiting_completion"
  | "needs_review"
  | "completed";

const transitions: Record<PaymentCheckoutState, readonly PaymentCheckoutState[]> = {
  awaiting_provider: ["awaiting_provider", "provider_verified", "needs_review"],
  provider_verified: ["provider_verified", "finalizing_order", "needs_review"],
  finalizing_order: ["finalizing_order", "awaiting_completion", "completed", "needs_review"],
  awaiting_completion: ["awaiting_completion", "finalizing_order", "completed", "needs_review"],
  needs_review: ["needs_review", "awaiting_provider"],
  completed: ["completed"],
};

export function isPaymentCheckoutState(value: string): value is PaymentCheckoutState {
  return Object.hasOwn(transitions, value);
}

export function assertPaymentCheckoutTransition(
  from: string | null | undefined,
  to: string,
): void {
  if (!isPaymentCheckoutState(to)) return;
  if (!from || !isPaymentCheckoutState(from)) return;
  if (!transitions[from].includes(to)) {
    throw new Error(`Invalid payment checkout transition: ${from} -> ${to}`);
  }
}
