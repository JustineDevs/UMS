import type { CheckoutEnv } from "./checkout.ts";
import type { WorkerDatabaseClient } from "./database.ts";

type PaymentMethodKey = "STRIPE" | "PAYPAL" | "XENDIT" | "COD";

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
export async function handlePaymentMethodsRequest(
  request: Request,
  env: CheckoutEnv,
  database?: WorkerDatabaseClient,
): Promise<Response> {
  if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);

  const keys: PaymentMethodKey[] = ["COD"];
  if (env.STRIPE_API_KEY?.trim()) keys.unshift("STRIPE");
  if (env.PAYPAL_CLIENT_ID?.trim() && env.PAYPAL_CLIENT_SECRET?.trim()) {
    keys.splice(keys.length - 1, 0, "PAYPAL");
  }
  if (env.XENDIT_SECRET_KEY?.trim()) keys.splice(keys.length - 1, 0, "XENDIT");

  if (database) {
    try {
      const organizationId = (env as CheckoutEnv & { DEFAULT_ORGANIZATION_ID?: string }).DEFAULT_ORGANIZATION_ID?.trim();
      if (organizationId) {
        const result = await database.query<{ payload?: { enabledPaymentProviders?: unknown } }>(
          `SELECT payload FROM public.platform_runtime_settings WHERE organization_id = $1 LIMIT 1`,
          [organizationId],
        );
        const configured = result.rows[0]?.payload?.enabledPaymentProviders;
        if (Array.isArray(configured)) {
          const allowed = new Set(configured.filter((value): value is PaymentMethodKey => typeof value === "string" && ["STRIPE", "PAYPAL", "XENDIT", "COD"].includes(value)));
          for (let index = keys.length - 1; index >= 0; index -= 1) if (!allowed.has(keys[index])) keys.splice(index, 1);
        }
      }
    } catch {
      // Env-only capability is the safe compatibility path during rollout.
    }
  }

  return json({ ok: keys.length > 0, keys, code: keys.length > 0 ? "ok" : "no_payment_providers", error: null, message: null });
}
