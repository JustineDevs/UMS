import type { WorkerDatabaseClient } from "./database.ts";
import { verifyWorkerBearerToken, type WorkerAuthClaims } from "./auth.ts";

type PaymentHealthEnv = {
  CMS_ADMIN_JWT_SECRET?: string;
  SUPABASE_URL?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  PAYPAL_WEBHOOK_ID?: string;
  PAYPAL_ENVIRONMENT?: string;
  XENDIT_WEBHOOK_TOKEN?: string;
};

type ProviderStatus = {
  enabled: boolean;
  webhookConfigured: boolean;
  sandboxMode?: boolean;
  notes?: string;
};

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function allowed(claims: WorkerAuthClaims): boolean {
  const permissions = Array.isArray(claims.permissions) ? claims.permissions : [];
  return claims.role === "owner" || claims.role === "admin" || permissions.some((value) => value === "*" || value === "payments:read");
}

function organization(claims: WorkerAuthClaims): string | null {
  const value = claims.organization_id ?? claims.org_id;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function handlePaymentHealthRequest(
  request: Request,
  database: WorkerDatabaseClient,
  env: PaymentHealthEnv,
): Promise<Response> {
  if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
  const claims = await verifyWorkerBearerToken(request.headers.get("Authorization"), {
    secret: env.CMS_ADMIN_JWT_SECRET,
    supabaseUrl: env.SUPABASE_URL,
  });
  if (!claims) return json({ error: "unauthorized" }, 401);
  if (!allowed(claims)) return json({ error: "forbidden" }, 403);
  const organizationId = organization(claims);
  if (!organizationId) return json({ error: "organization_claim_required" }, 403);
  const result = await database.query<{ provider: string | null }>(
    `SELECT provider FROM public.payment_nango_connections
      WHERE organization_id = $1 AND active = true`,
    [organizationId],
  );
  const connected = new Set(result.rows.map((row) => row.provider).filter((value): value is string => typeof value === "string"));
  const paypalSandbox = (env.PAYPAL_ENVIRONMENT ?? "sandbox").trim().toLowerCase() !== "production" && (env.PAYPAL_ENVIRONMENT ?? "sandbox").trim().toLowerCase() !== "live";
  const stripe: ProviderStatus = {
    enabled: connected.has("stripe"),
    webhookConfigured: Boolean(env.STRIPE_WEBHOOK_SECRET?.trim()),
  };
  const paypal: ProviderStatus = {
    enabled: connected.has("paypal"),
    webhookConfigured: Boolean(env.PAYPAL_WEBHOOK_ID?.trim()),
    sandboxMode: paypalSandbox,
    notes: !env.PAYPAL_WEBHOOK_ID?.trim() ? "PAYPAL_WEBHOOK_ID is required for webhook verification." : undefined,
  };
  const xendit: ProviderStatus = {
    enabled: connected.has("xendit"),
    webhookConfigured: Boolean(env.XENDIT_WEBHOOK_TOKEN?.trim()),
  };
  const cod: ProviderStatus = { enabled: true, webhookConfigured: true, notes: "COD does not use provider webhooks." };
  const production = (env.PAYPAL_ENVIRONMENT ?? "").trim().toLowerCase() === "production" || (env.PAYPAL_ENVIRONMENT ?? "").trim().toLowerCase() === "live";
  const warnings: string[] = [];
  if (production && paypal.enabled && paypalSandbox) warnings.push("PayPal is configured as sandbox while production mode is expected.");
  if (stripe.enabled && !stripe.webhookConfigured) warnings.push("Stripe is enabled but its webhook secret is not configured.");
  if (paypal.enabled && !paypal.webhookConfigured) warnings.push("PayPal is enabled but its webhook ID is not configured.");
  if (xendit.enabled && !xendit.webhookConfigured) warnings.push("Xendit is enabled but its callback token is not configured.");
  return json({ environment: production ? "production" : "non_production", isProduction: production, providers: { stripe, paypal, xendit, cod }, warnings, ok: warnings.length === 0 });
}
