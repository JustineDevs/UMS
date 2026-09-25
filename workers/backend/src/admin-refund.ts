import {
  withWorkerDatabase,
  withWorkerTransaction,
  type WorkerDatabaseClient,
  type WorkerDatabaseEnv,
} from "./database.ts";
import { executeIdempotently, HyperdriveIdempotencyStore } from "./idempotency.ts";
import { refundPayPalCapture, refundStripePayment, refundXenditPayment } from "./providers.ts";
import { resolveWorkerStaffPrincipal, workerStaffHasPermission } from "./staff-principal.ts";
import { applyProviderRefundUpdate, providerRefundUpdate, refundStatusState } from "./refund-reconciliation.ts";

export type AdminRefundEnv = WorkerDatabaseEnv & {
  CMS_ADMIN_JWT_SECRET?: string;
  SUPABASE_URL?: string;
  ADMIN_STEP_UP_REQUIRED?: string;
  ADMIN_STEP_UP_SECRET?: string;
  STRIPE_API_KEY?: string;
  PAYPAL_CLIENT_ID?: string;
  PAYPAL_CLIENT_SECRET?: string;
  PAYPAL_ENVIRONMENT?: string;
  XENDIT_SECRET_KEY?: string;
  providerFetch?: typeof fetch;
  databaseFactory?: (_role: "app" | "medusa") => WorkerDatabaseClient;
};

type PaymentRow = {
  id: string;
  order_id: string;
  amount: number | string;
  currency_code: string;
  provider_id: string;
  data: Record<string, unknown> | null;
};

type RefundReservation = {
  amount_minor: number | string;
  medusa_payment_id: string;
  provider: string | null;
  provider_refund_id: string | null;
  provider_status: string | null;
  status: string;
};

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
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
  for (const nestedKey of ["providerPayload", "xenditSession"]) {
    const nested = data?.[nestedKey];
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      const value = payloadValue(nested as Record<string, unknown>, keys);
      if (value) return value;
    }
  }
  return null;
}

async function withRole<T>(env: AdminRefundEnv, role: "app" | "medusa", operation: (_database: WorkerDatabaseClient) => Promise<T>): Promise<T> {
  if (!env.databaseFactory) return withWorkerDatabase(env, operation, role);
  const database = env.databaseFactory(role);
  try { return await operation(database); } finally { await database.end(); }
}

async function requestHash(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function stepUpValid(request: Request, env: AdminRefundEnv): Promise<boolean> {
  if (env.ADMIN_STEP_UP_REQUIRED !== "true") return true;
  const assertion = request.headers.get("x-admin-step-up")?.trim() ?? "";
  const match = /^orders\.refund\.(\d+)\.([a-f0-9]{64})$/.exec(assertion);
  if (!match || !env.ADMIN_STEP_UP_SECRET) return false;
  const expires = Number(match[1]);
  if (!Number.isSafeInteger(expires) || expires < Math.floor(Date.now() / 1000)) return false;
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(env.ADMIN_STEP_UP_SECRET.trim()),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    return await crypto.subtle.verify(
      "HMAC",
      key,
      Uint8Array.from(match[2].match(/.{2}/g) ?? [], (byte) => Number.parseInt(byte, 16)),
      new TextEncoder().encode(`orders.refund.${expires}`),
    );
  } catch {
    return false;
  }
}

export async function handleAdminRefundRequest(
  request: Request,
  env: AdminRefundEnv,
  orderId: string,
): Promise<Response> {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!request.headers.get("Authorization")) return json({ error: "unauthorized" }, 401);
  const key = request.headers.get("Idempotency-Key")?.trim();
  if (!key || !/^[A-Za-z0-9._:-]{8,200}$/.test(key)) return json({ error: "idempotency_key_required" }, 400);
  if (!id(orderId)) return json({ error: "invalid_order_id" }, 400);
  let body: unknown;
  try { body = await request.json(); } catch { return json({ error: "invalid_json" }, 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "invalid_refund_payload" }, 400);
  const input = body as Record<string, unknown>;
  const paymentId = input.payment_id === undefined ? null : id(input.payment_id);
  const requestedAmount = input.amount_minor === undefined ? null : minor(input.amount_minor);
  if (input.payment_id !== undefined && !paymentId) return json({ error: "invalid_payment_id" }, 400);
  if (requestedAmount !== null && requestedAmount < 1) return json({ error: "invalid_amount" }, 400);
  return withRole(env, "app", async (app) => {
    const principal = await resolveWorkerStaffPrincipal(request, app, env);
    if (principal instanceof Response) return principal;
    if (!workerStaffHasPermission(principal, "orders:write")) return json({ error: "forbidden" }, 403);
    if (!(await stepUpValid(request, env))) return json({ error: "step_up_required" }, 403);
    const hash = await requestHash({ organizationId: principal.organizationId, actorId: principal.userId, orderId, paymentId, requestedAmount, note: typeof input.note === "string" ? input.note.trim().slice(0, 500) : null });
    const scopedKey = await requestHash({ action: "orders.refund", organizationId: principal.organizationId, actorId: principal.userId, key });
    const store = new HyperdriveIdempotencyStore(app);
    const result = await executeIdempotently(store, scopedKey, hash, async () => {
      const ownedOrder = await withRole(env, "medusa", (medusa) => medusa.query<{ id: string }>(
        `SELECT id FROM public."order"
          WHERE id = $1 AND deleted_at IS NULL AND metadata->>'organization_id' = $2
          LIMIT 1`,
        [orderId, principal.organizationId],
      ));
      if (!ownedOrder.rows[0]) return json({ error: "not_found" }, 404);
      const paymentResult = await withRole(env, "medusa", async (medusa) => {
        const payments = await medusa.query<PaymentRow>(
          `SELECT p.id, opc.order_id, p.amount, p.currency_code, p.provider_id, p.data
             FROM public.payment p
             JOIN public.order_payment_collection opc ON opc.payment_collection_id = p.payment_collection_id
             JOIN public."order" o ON o.id = opc.order_id AND o.deleted_at IS NULL
            WHERE opc.order_id = $1 AND o.metadata->>'organization_id' = $3 AND p.deleted_at IS NULL
              AND ($2::text IS NULL OR p.id = $2)
            ORDER BY p.created_at ASC`,
          [orderId, paymentId, principal.organizationId],
        );
        const payment = payments.rows[0];
        if (!payment) return { response: json({ error: "payment_not_found" }, 404), payment: null };
        const provider = providerName(payment.provider_id);
        if (!provider) return { response: json({ error: "provider_refund_not_supported" }, 422), payment: null };
        const captured = dataMinor(payment.data, ["captured_amount_minor", "captured_amount"]) ?? minor(payment.amount);
        const providerPaymentId = provider === "stripe"
          ? payloadValue(payment.data, ["providerPaymentId", "payment_intent", "id"])
          : provider === "paypal"
            ? payloadValue(payment.data, ["paypal_capture_id", "capture_id"])
            : payloadValue(payment.data, ["xendit_payment_request_id", "payment_request_id"]);
        if (!providerPaymentId) return { response: json({ error: "provider_payment_reference_missing" }, 409), payment: null };
        return { response: null, payment: { payment, provider, captured, providerPaymentId } };
      });
      if (paymentResult.response || !paymentResult.payment) return paymentResult.response ?? json({ error: "payment_not_found" }, 404);
      const { payment, provider, captured, providerPaymentId } = paymentResult.payment;
      const reservation = await withWorkerTransaction(app, async (transaction) => {
        const lockKey = `${principal.organizationId}:${orderId}:${payment.id}`;
        await transaction.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [lockKey]);
        const existing = await transaction.query<RefundReservation>(
          `SELECT amount_minor, medusa_payment_id, provider, provider_refund_id, provider_status, status
             FROM public.payment_refund_audit
            WHERE organization_id = $1 AND request_idempotency_key = $2
            FOR UPDATE`,
          [principal.organizationId, scopedKey],
        );
        const prior = existing.rows[0];
        if (prior) {
          if (prior.medusa_payment_id !== payment.id || (prior.provider && prior.provider !== provider)) {
            return { response: json({ error: "refund_reservation_conflict" }, 409), reservation: null };
          }
          return { response: null, reservation: prior };
        }
        const priorRefunds = await transaction.query<{ completed_minor: number | string | null; reserved_minor: number | string | null }>(
          `SELECT COALESCE(SUM(amount_minor) FILTER (WHERE status = 'completed'), 0) AS completed_minor,
                  COALESCE(SUM(amount_minor) FILTER (WHERE status IN ('requested', 'pending', 'processing')), 0) AS reserved_minor
             FROM public.payment_refund_audit
            WHERE medusa_order_id = $1 AND (organization_id = $2 OR organization_id IS NULL)
              AND ($3::text IS NULL OR medusa_payment_id = $3)
              AND request_idempotency_key IS DISTINCT FROM $4
              AND status IN ('requested', 'pending', 'processing', 'completed')`,
          [orderId, principal.organizationId, payment.id, scopedKey],
        );
        const storedRefund = dataMinor(payment.data, ["refunded_amount_minor", "refunded_amount"]) ?? 0;
        const refunded = Math.max(storedRefund, minor(priorRefunds.rows[0]?.completed_minor)) + minor(priorRefunds.rows[0]?.reserved_minor);
        const refundable = Math.max(0, captured - refunded);
        const amount = requestedAmount ?? refundable;
        if (amount < 1 || amount > refundable) {
          return { response: json({ error: "amount_exceeds_refundable_balance", refundable_minor: refundable }, 409), reservation: null };
        }
        const inserted = await transaction.query<RefundReservation>(
          `INSERT INTO public.payment_refund_audit
            (medusa_order_id, medusa_payment_id, provider, amount_minor, actor_email, note, request_idempotency_key, request_correlation_id, status, organization_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'requested', $9)
           RETURNING amount_minor, medusa_payment_id, provider, provider_refund_id, provider_status, status`,
          [orderId, payment.id, provider, amount, principal.email, typeof input.note === "string" ? input.note.trim().slice(0, 500) : null, scopedKey, request.headers.get("X-Request-ID")?.trim() ?? null, principal.organizationId],
        );
        if (!inserted.rows[0]) throw new Error("refund_reservation_insert_failed");
        return { response: null, reservation: inserted.rows[0] };
      });
      if (reservation.response || !reservation.reservation) return reservation.response ?? json({ error: "refund_reservation_failed" }, 503);
      const amount = minor(reservation.reservation.amount_minor);
      if (reservation.reservation.status === "completed") {
        return json({ ok: true, payment_id: payment.id, provider, refund_id: reservation.reservation.provider_refund_id, provider_status: reservation.reservation.provider_status, amount_minor: amount });
      }
      if (reservation.reservation.status === "failed") {
        return json({ error: "provider_refund_failed", provider_status: reservation.reservation.provider_status }, 409);
      }
      const providerKey = await requestHash({ scopedKey, provider });
      let providerResult: { id: string | null; status: string | null };
      try {
        if (provider === "stripe") {
          const result = await refundStripePayment({ secretKey: env.STRIPE_API_KEY ?? "", paymentIntentId: providerPaymentId, amountMinor: amount, idempotencyKey: providerKey, fetcher: env.providerFetch });
          providerResult = { id: result.id, status: result.status };
        } else if (provider === "paypal") {
          const decimals = payment.currency_code.toUpperCase() === "JPY" ? 0 : 2;
          const major = (amount / (10 ** decimals)).toFixed(decimals);
          providerResult = await refundPayPalCapture({ clientId: env.PAYPAL_CLIENT_ID ?? "", clientSecret: env.PAYPAL_CLIENT_SECRET ?? "", sandbox: (env.PAYPAL_ENVIRONMENT ?? "sandbox") !== "production", captureId: providerPaymentId, amountMajor: major, currency: payment.currency_code, idempotencyKey: providerKey, fetcher: env.providerFetch });
        } else {
          providerResult = await refundXenditPayment({ secretKey: env.XENDIT_SECRET_KEY ?? "", paymentRequestId: providerPaymentId, referenceId: orderId, amountMinor: amount, currency: payment.currency_code, idempotencyKey: providerKey, fetcher: env.providerFetch });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "provider_error";
        const httpStatus = /_request_failed:(\d{3})$/.exec(message)?.[1];
        const rejected = httpStatus !== undefined && Number(httpStatus) >= 400 && Number(httpStatus) < 500 && Number(httpStatus) !== 429;
        const notConfigured = message.endsWith("_not_configured") || message.includes("_invalid_");
        if (rejected || notConfigured) {
          await app.query(
            `UPDATE public.payment_refund_audit SET status = 'failed', result_error = $3
              WHERE organization_id = $1 AND request_idempotency_key = $2 AND status IN ('requested', 'pending', 'processing')`,
            [principal.organizationId, scopedKey, message.slice(0, 200)],
          );
          return json({ error: "provider_refund_rejected" }, 409);
        }
        return json({ error: "provider_refund_outcome_unknown" }, 503);
      }
      const providerStatus = refundStatusState(provider, providerResult.status);
      await app.query(
        `UPDATE public.payment_refund_audit
            SET provider = $3, provider_refund_id = $4, provider_status = $5,
                status = CASE WHEN status IN ('requested', 'pending', 'processing') THEN $6 ELSE status END,
                completed_at = CASE WHEN status = 'completed' OR $6 = 'completed' THEN COALESCE(completed_at, now()) ELSE NULL END
          WHERE organization_id = $1 AND request_idempotency_key = $2`,
        [principal.organizationId, scopedKey, provider, providerResult.id, providerResult.status, providerStatus],
      );
      let reconciledStatus: "completed" | "failed" | null = null;
      if (provider !== "paypal" && providerResult.id) {
        const earlyEvent = await withRole(env, "medusa", async (medusa) => medusa.query<{
          event_type: string;
          payload: Record<string, unknown>;
        }>(
          `SELECT event_type, payload
             FROM public.payment_webhook_events
            WHERE provider = $1 AND payload #>> $2::text[] = $3
            ORDER BY received_at DESC
            LIMIT 1`,
          [
            provider,
            provider === "stripe" ? ["data", "object", "id"] : ["data", "id"],
            providerResult.id,
          ],
        ));
        const event = earlyEvent.rows[0];
        const update = event && providerRefundUpdate(provider, event.event_type, event.payload);
        if (update && await applyProviderRefundUpdate(app, provider, update) && update.state !== "pending") {
          reconciledStatus = update.state;
        }
        if (reconciledStatus === "completed") {
          return json({ ok: true, payment_id: payment.id, provider, refund_id: providerResult.id, provider_status: update?.providerStatus ?? providerResult.status, amount_minor: amount });
        }
      }
      if (providerStatus === "failed" || reconciledStatus === "failed") {
        return json({ error: "provider_refund_failed", provider_status: providerResult.status }, 409);
      }
      return json({ ok: true, payment_id: payment.id, provider, refund_id: providerResult.id, provider_status: providerResult.status, amount_minor: amount }, providerStatus === "pending" ? 202 : 200);
    });
    return result.response;
  });
}
