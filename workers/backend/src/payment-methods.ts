import type { CheckoutEnv } from "./checkout.ts";

export type PaymentMethodKey = "STRIPE" | "PAYPAL" | "XENDIT" | "COD";

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

/**
 * Exposes capability only. Provider credentials and connection details never
 * leave the Worker; the storefront only needs the methods it may render.
 */
export function handlePaymentMethodsRequest(
  request: Request,
  env: CheckoutEnv,
): Response {
  if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);

  const keys: PaymentMethodKey[] = ["COD"];
  if (env.STRIPE_API_KEY?.trim()) keys.unshift("STRIPE");
  if (env.PAYPAL_CLIENT_ID?.trim() && env.PAYPAL_CLIENT_SECRET?.trim()) {
    keys.splice(keys.length - 1, 0, "PAYPAL");
  }
  if (env.XENDIT_SECRET_KEY?.trim()) keys.splice(keys.length - 1, 0, "XENDIT");

  return json({ ok: keys.length > 0, keys, code: keys.length > 0 ? "ok" : "no_payment_providers", error: null, message: null });
}
