/** Stripe self-serve/Connect is intentionally locked for Philippine merchants until availability is enabled. */
export function stripeAvailableForMerchant(
  country = process.env.UVS_MERCHANT_COUNTRY ?? "PH",
): boolean {
  return country.trim().toUpperCase() !== "PH";
}

export const STRIPE_UNAVAILABLE_IN_MERCHANT_COUNTRY =
  "STRIPE_UNAVAILABLE_IN_MERCHANT_COUNTRY";
