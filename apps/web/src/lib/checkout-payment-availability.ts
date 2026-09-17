import {
  PAYMENT_PROVIDER_IDS,
  type PaymentProviderKey,
} from "@/lib/checkout-worker";

export type CheckoutPaymentAvailabilitySource = "worker" | "unavailable";

function availability(
  keys: PaymentProviderKey[],
): Record<PaymentProviderKey, boolean> {
  const allowed = new Set(keys);
  return Object.fromEntries(
    (Object.keys(PAYMENT_PROVIDER_IDS) as PaymentProviderKey[]).map((key) => [
      key,
      allowed.has(key),
    ]),
  ) as Record<PaymentProviderKey, boolean>;
}

/**
 * Resolves the payment capability returned by the Worker. An absent or empty
 * response is unavailable; no client-side credential or provider fallback is
 * allowed because that can render payment methods the Worker cannot execute.
 */
export function resolveCheckoutPaymentAvailability(
  workerKeys: PaymentProviderKey[] | null | undefined,
): {
  available: Record<PaymentProviderKey, boolean>;
  preferredKey: PaymentProviderKey;
  source: CheckoutPaymentAvailabilitySource;
} {
  if (!workerKeys || workerKeys.length === 0) {
    return {
      available: availability([]),
      preferredKey: "COD",
      source: "unavailable",
    };
  }

  const validKeys = workerKeys.filter((key) => key in PAYMENT_PROVIDER_IDS);
  return {
    available: availability(validKeys),
    preferredKey: validKeys[0] ?? "COD",
    source: validKeys.length > 0 ? "worker" : "unavailable",
  };
}
