import {
  PAYMENT_PROVIDER_IDS,
  type PaymentProviderKey,
} from "@/lib/medusa-checkout";

export type CheckoutPaymentAvailabilitySource = "medusa" | "env";

/**
 * When the storefront can read your Medusa region (see `/api/checkout/available-payment-methods`),
 * every method attached to that region is offered, optionally filtered by
 * `NEXT_PUBLIC_CHECKOUT_PAYMENT_PROVIDERS`.
 *
 * If that API is unavailable, this env-only fallback runs:
 * - Set `NEXT_PUBLIC_CHECKOUT_PAYMENT_PROVIDERS` to a comma-separated list (STRIPE, PAYPAL, XENDIT, COD).
 * - If unset: **all** of those keys are shown as selectable. `NEXT_PUBLIC_MEDUSA_PAYMENT_PROVIDER_ID` only picks
 *   which option is pre-selected (default highlight). Each method must still be attached to your Medusa region
 *   or payment session creation will fail for that choice.
 */
export function getEnvOnlyCheckoutPaymentAvailability(): {
  available: Record<PaymentProviderKey, boolean>;
  preferredKey: PaymentProviderKey;
} {
  const allKeys = Object.keys(PAYMENT_PROVIDER_IDS) as PaymentProviderKey[];
  const raw = process.env.NEXT_PUBLIC_CHECKOUT_PAYMENT_PROVIDERS?.trim();

  let enabled: PaymentProviderKey[];
  if (raw) {
    const parts = raw
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    enabled = parts.filter((p): p is PaymentProviderKey =>
      allKeys.includes(p as PaymentProviderKey),
    );
    if (enabled.length === 0) {
      enabled = [];
    }
  } else {
    // When NEXT_PUBLIC_CHECKOUT_PAYMENT_PROVIDERS is unset, show only COD as the safe default.
    // Operators must explicitly list providers in NEXT_PUBLIC_CHECKOUT_PAYMENT_PROVIDERS to enable PSPs.
    // Showing all providers when keys are missing causes phantom availability — users select a PSP
    // that fails at payment session creation because its API keys were never configured.
    enabled = ["COD" as PaymentProviderKey];
  }

  const available = Object.fromEntries(
    allKeys.map((k) => [k, enabled.includes(k)]),
  ) as Record<PaymentProviderKey, boolean>;

  const preferredKey = enabled[0] ?? "STRIPE";

  return { available, preferredKey };
}

function mergeMedusaRegionWithEnvAllowlist(regionKeys: PaymentProviderKey[]): {
  available: Record<PaymentProviderKey, boolean>;
  preferredKey: PaymentProviderKey;
} {
  const allKeys = Object.keys(PAYMENT_PROVIDER_IDS) as PaymentProviderKey[];
  const raw = process.env.NEXT_PUBLIC_CHECKOUT_PAYMENT_PROVIDERS?.trim();
  let envAllow: Set<PaymentProviderKey> | null = null;
  if (raw) {
    const parts = raw
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
      .filter((p): p is PaymentProviderKey =>
        allKeys.includes(p as PaymentProviderKey),
      );
    if (parts.length > 0) {
      envAllow = new Set(parts);
    }
  }

  const regionSet = new Set(regionKeys);
  const available = Object.fromEntries(
    allKeys.map((k) => [
      k,
      regionSet.has(k) && (!envAllow || envAllow.has(k)),
    ]),
  ) as Record<PaymentProviderKey, boolean>;

  const preferredKey =
    allKeys.find((k) => available[k]) ?? regionKeys[0] ?? "STRIPE";

  return { available, preferredKey };
}

/**
 * Prefer non-empty `medusaRegionKeys` from GET `/api/checkout/available-payment-methods`
 * so the UI matches Medusa Admin → Regions → payment providers.
 */
export function resolveCheckoutPaymentAvailability(
  medusaRegionKeys: PaymentProviderKey[] | null | undefined,
): {
  available: Record<PaymentProviderKey, boolean>;
  preferredKey: PaymentProviderKey;
  source: CheckoutPaymentAvailabilitySource;
} {
  if (medusaRegionKeys === null || medusaRegionKeys === undefined) {
    return {
      ...getEnvOnlyCheckoutPaymentAvailability(),
      source: "env",
    };
  }
  if (medusaRegionKeys.length === 0) {
    const allKeys = Object.keys(PAYMENT_PROVIDER_IDS) as PaymentProviderKey[];
    const available = Object.fromEntries(
      allKeys.map((k) => [k, false]),
    ) as Record<PaymentProviderKey, boolean>;
    return {
      available,
      preferredKey: "STRIPE",
      source: "medusa",
    };
  }
  return {
    ...mergeMedusaRegionWithEnvAllowlist(medusaRegionKeys),
    source: "medusa",
  };
}

/** @deprecated Prefer `resolveCheckoutPaymentAvailability` after loading region keys from the API. */
function getCheckoutPaymentAvailability(): {
  available: Record<PaymentProviderKey, boolean>;
  preferredKey: PaymentProviderKey;
} {
  return getEnvOnlyCheckoutPaymentAvailability();
}
