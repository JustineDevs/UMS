import type { WorkerDatabaseClient } from "./database.ts";
import { confirmPayPalOrder } from "./providers.ts";

type PayPalConfirmEnv = { PAYPAL_CLIENT_ID?: string; PAYPAL_CLIENT_SECRET?: string; PAYPAL_ENVIRONMENT?: string };

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

function cookie(request: Request, name: string): string | null {
  return (request.headers.get("Cookie") ?? "").split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1) ?? null;
}

export async function handlePayPalConfirmationRequest(request: Request, database: WorkerDatabaseClient, env: PayPalConfirmEnv): Promise<Response> {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const idempotencyKey = request.headers.get("Idempotency-Key")?.trim();
  if (!idempotencyKey) return json({ error: "idempotency_key_required" }, 400);
  let body: unknown;
  try { body = await request.json(); } catch { return json({ error: "invalid_json" }, 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "invalid_request" }, 400);
  const input = body as Record<string, unknown>;
  const correlationId = typeof input.correlationId === "string" ? input.correlationId.trim() : "";
  const orderId = typeof input.orderId === "string" ? input.orderId.trim() : "";
  if (!/^[0-9a-f-]{36}$/i.test(correlationId) || !orderId) return json({ error: "invalid_identifiers" }, 400);
  const attempt = await database.query<{ cart_id: string; provider: string; provider_session_id: string | null; amount_minor: number | string; currency: string; status: string }>(
    `SELECT cart_id, provider, provider_session_id, amount_minor, currency, status FROM public.payment_attempts WHERE correlation_id = $1::uuid`, [correlationId]);
  const row = attempt.rows[0];
  if (!row || row.provider !== "paypal" || row.provider_session_id !== orderId) return json({ error: "checkout_not_found" }, 404);
  if (cookie(request, "checkout_attempt_id") !== correlationId && cookie(request, "mcart_id") !== row.cart_id) return json({ error: "checkout_not_found" }, 404);
  if (["paid", "completed"].includes(row.status.toLowerCase())) return json({ ok: true, correlationId });
  try {
    const confirmed = await confirmPayPalOrder({ clientId: env.PAYPAL_CLIENT_ID ?? "", clientSecret: env.PAYPAL_CLIENT_SECRET ?? "", sandbox: (env.PAYPAL_ENVIRONMENT ?? "sandbox") !== "production", orderId, expectedAmountMinor: Number(row.amount_minor), expectedCurrency: row.currency, idempotencyKey });
    await database.query(`UPDATE public.payment_attempts SET provider_payment_id = $2, provider_payload = $3::jsonb, status = 'paid', checkout_state = 'provider_verified', updated_at = now() WHERE correlation_id = $1::uuid AND status NOT IN ('paid', 'completed')`, [correlationId, confirmed.captureId, JSON.stringify(confirmed.payload)]);
    return json({ ok: true, correlationId, captureId: confirmed.captureId });
  } catch (error) {
    return json({ error: "paypal_confirmation_failed", code: "PAYPAL_CONFIRMATION_FAILED" }, 502);
  }
}
