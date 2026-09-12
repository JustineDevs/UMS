import { verifyWorkerBearerToken, type WorkerAuthClaims } from "./auth.ts";
import {
  withWorkerDatabase,
  withWorkerTransaction,
  type WorkerDatabaseClient,
  type WorkerDatabaseEnv,
} from "./database.ts";
import { executeIdempotently, HyperdriveIdempotencyStore } from "./idempotency.ts";
import { refundPayPalCapture, refundStripePayment, refundXenditPayment } from "./providers.ts";

export type AdminRefundEnv = WorkerDatabaseEnv & {
  CMS_ADMIN_JWT_SECRET?: string;
  SUPABASE_URL?: string;
  STRIPE_API_KEY?: string;
  PAYPAL_CLIENT_ID?: string;
  PAYPAL_CLIENT_SECRET?: string;
  PAYPAL_ENVIRONMENT?: string;
  XENDIT_SECRET_KEY?: string;
  providerFetch?: typeof fetch;
  databaseFactory?: (role: "app" | "medusa") => WorkerDatabaseClient;
};

type PaymentRow = {
  id: string;
  order_id: string;
  amount: number | string;
  currency_code: string;
  provider_id: string;
  data: Record<string, unknown> | null;
};

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function allowed(claims: WorkerAuthClaims): boolean {
  const permissions = Array.isArray(claims.permissions) ? claims.permissions : [];
  return claims.role === "owner" || claims.role === "admin" || permissions.some((value) => value === "*" || value === "orders:write");
}

function id(value: unknown): string | null {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value.trim()) ? value.trim() : null;
}

function minor(value: unknown): number {
  const number = Number(value);
  return Number.isSafeInteger(number) ? Math.max(0, number) : 0;
}

function dataMinor(data: Record<string, unknown> | null, keys: string[]): number | null {
  for (const key of keys) {
    const value = data?.[key];
    if (typeof value === "number" || typeof value === "string") {
      const parsed = Number(value);
      if (Number.isSafeInteger(parsed) && parsed >= 0) return parsed;
    }
  }
  return null;
}

function providerName(providerId: string): "stripe" | "paypal" | "xendit" | null {
  const value = providerId.toLowerCase();
  if (value.includes("stripe")) return "stripe";
  if (value.includes("paypal")) return "paypal";
  if (value.includes("xendit")) return "xendit";
  return null;
}

function payloadValue(data: Record<string, unknown> | null, keys: string[]): string | null {
  for (const key of keys) {
    const value = data?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  const nested = data?.providerPayload;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) return payloadValue(nested as Record<string, unknown>, keys);
  return null;
}

async function withRole<T>(env: AdminRefundEnv, role: "app" | "medusa", operation: (database: WorkerDatabaseClient) => Promise<T>): Promise<T> {
  if (!env.databaseFactory) return withWorkerDatabase(env, operation, role);
  const database = env.databaseFactory(role);
  try { return await operation(database); } finally { await database.end(); }
}

async function requestHash(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function handleAdminRefundRequest(
  request: Request,
  env: AdminRefundEnv,
  orderId: string,
): Promise<Response> {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const claims = await verifyWorkerBearerToken(request.headers.get("Authorization"), { secret: env.CMS_ADMIN_JWT_SECRET, supabaseUrl: env.SUPABASE_URL });
  if (!claims) return json({ error: "unauthorized" }, 401);
  if (!allowed(claims)) return json({ error: "forbidden" }, 403);
  const key = request.headers.get("Idempotency-Key")?.trim();
  if (!key || key.length > 255) return json({ error: "idempotency_key_required" }, 400);
  if (!id(orderId)) return json({ error: "invalid_order_id" }, 400);
  let body: unknown;
  try { body = await request.json(); } catch { return json({ error: "invalid_json" }, 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "invalid_refund_payload" }, 400);
  const input = body as Record<string, unknown>;
  const paymentId = input.payment_id === undefined ? null : id(input.payment_id);
  const requestedAmount = input.amount_minor === undefined ? null : minor(input.amount_minor);
  if (input.payment_id !== undefined && !paymentId) return json({ error: "invalid_payment_id" }, 400);
  if (requestedAmount !== null && requestedAmount < 1) return json({ error: "invalid_amount" }, 400);
  const hash = await requestHash({ orderId, paymentId, requestedAmount, note: typeof input.note === "string" ? input.note.trim().slice(0, 500) : null });

  return withRole(env, "app", async (app) => {
    const store = new HyperdriveIdempotencyStore(app);
    const result = await executeIdempotently(store, key, hash, async () => {
      const priorRefunds = await app.query<{ refunded_minor: number | string | null }>(
        `SELECT COALESCE(SUM(amount_minor), 0) AS refunded_minor
           FROM public.payment_refund_audit
          WHERE medusa_order_id = $1 AND ($2::text IS NULL OR medusa_payment_id = $2)
            AND status = 'completed'`,
        [orderId, paymentId],
      );
      const refundedFromAudit = minor(priorRefunds.rows[0]?.refunded_minor);
      const outcome = await withRole(env, "medusa", async (medusa) => {
        const payments = await medusa.query<PaymentRow>(
          `SELECT p.id, opc.order_id, p.amount, p.currency_code, p.provider_id, p.data
             FROM public.payment p
             JOIN public.order_payment_collection opc ON opc.payment_collection_id = p.payment_collection_id
            WHERE opc.order_id = $1 AND p.deleted_at IS NULL
              AND ($2::text IS NULL OR p.id = $2)
            ORDER BY p.created_at ASC`,
          [orderId, paymentId],
        );
        const payment = payments.rows[0];
        if (!payment) return { response: json({ error: "payment_not_found" }, 404), audit: null };
        const provider = providerName(payment.provider_id);
        if (!provider) return { response: json({ error: "provider_refund_not_supported" }, 422), audit: null };
        const captured = dataMinor(payment.data, ["captured_amount_minor", "captured_amount"]) ?? minor(payment.amount);
        const refunded = Math.max(
          dataMinor(payment.data, ["refunded_amount_minor", "refunded_amount"]) ?? 0,
          refundedFromAudit,
        );
        const refundable = Math.max(0, captured - refunded);
        const amount = requestedAmount ?? refundable;
        if (amount < 1 || amount > refundable) return { response: json({ error: "amount_exceeds_refundable_balance", refundable_minor: refundable }, 409), audit: null };
        const providerPaymentId = provider === "stripe"
          ? payloadValue(payment.data, ["providerPaymentId", "payment_intent", "id"])
          : provider === "paypal"
            ? payloadValue(payment.data, ["paypal_capture_id", "capture_id"])
            : payloadValue(payment.data, ["xendit_payment_request_id", "payment_request_id"]);
        if (!providerPaymentId) return { response: json({ error: "provider_payment_reference_missing" }, 409), audit: null };
        let providerResult: { id: string | null; status: string | null };
        if (provider === "stripe") {
          const result = await refundStripePayment({ secretKey: env.STRIPE_API_KEY ?? "", paymentIntentId: providerPaymentId, amountMinor: amount, idempotencyKey: key, fetcher: env.providerFetch });
          providerResult = { id: result.id, status: result.status };
        } else if (provider === "paypal") {
          const decimals = payment.currency_code.toUpperCase() === "JPY" ? 0 : 2;
          const major = (amount / (10 ** decimals)).toFixed(decimals);
          providerResult = await refundPayPalCapture({ clientId: env.PAYPAL_CLIENT_ID ?? "", clientSecret: env.PAYPAL_CLIENT_SECRET ?? "", sandbox: (env.PAYPAL_ENVIRONMENT ?? "sandbox") !== "production", captureId: providerPaymentId, amountMajor: major, currency: payment.currency_code, idempotencyKey: key, fetcher: env.providerFetch });
        } else {
          providerResult = await refundXenditPayment({ secretKey: env.XENDIT_SECRET_KEY ?? "", paymentRequestId: providerPaymentId, amountMinor: amount, currency: payment.currency_code, idempotencyKey: key, fetcher: env.providerFetch });
        }
        return { response: json({ ok: true, payment_id: payment.id, provider, refund_id: providerResult.id, provider_status: providerResult.status, amount_minor: amount }), audit: { paymentId: payment.id, amount } };
      });
      if (!outcome.audit) return outcome.response;
      await withWorkerTransaction(app, (transaction) => transaction.query(
        `INSERT INTO public.payment_refund_audit
          (medusa_order_id, medusa_payment_id, amount_minor, actor_email, note, request_correlation_id, status, completed_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'completed', now())`,
        [orderId, outcome.audit.paymentId, outcome.audit.amount, typeof claims.email === "string" ? claims.email : null, typeof input.note === "string" ? input.note.trim().slice(0, 500) : null, request.headers.get("X-Request-ID")?.trim() ?? null],
      ));
      return outcome.response;
    });
    return result.response;
  });
}
