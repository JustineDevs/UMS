import { withWorkerDatabase, type WorkerDatabaseClient, type WorkerDatabaseEnv } from "./database.ts";
import { finalizeNativeOrderAcrossDatabases } from "./order-finalization.ts";
import { createCommerceJob } from "./queue.ts";
import { expireDueReservations } from "./jobs.ts";
import { handleCatalogProductRequest } from "./catalog.ts";
import { runCampaignSweep } from "./campaigns-cron.ts";
import { runPaymentReconciliationSweep } from "./payment-reconciliation-cron.ts";
import { runMediaStorageCleanupSweep } from "./media-storage-cleanup.ts";

export type WorkerCronEnv = WorkerDatabaseEnv & {
  CRON_SECRET?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  RESEND_FROM?: string;
  PUBLIC_SITE_URL?: string;
  NANGO_API_KEY?: string;
  SUPABASE_URL?: string;
  SUPABASE_STORAGE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  fetch?: typeof fetch;
};

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

async function equalSecret(expected: string, actual: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [left, right] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
    crypto.subtle.digest("SHA-256", encoder.encode(actual)),
  ]);
  const a = new Uint8Array(left);
  const b = new Uint8Array(right);
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a[index] ^ b[index];
  return difference === 0;
}

export async function runPaymentFinalizationSweep(
  app: WorkerDatabaseClient,
  commerce: WorkerDatabaseClient,
  finalize: typeof finalizeNativeOrderAcrossDatabases = finalizeNativeOrderAcrossDatabases,
): Promise<{ ok: true; processed: number; completed: number; errors: string[] }> {
  const attempts = await app.query<{ correlation_id: string }>(
    `SELECT correlation_id::text FROM public.payment_attempts
     WHERE medusa_order_id IS NULL
       AND (status IN ('paid','paid_awaiting_order','completed','captured') OR (provider='cod' AND status='initiated'))
       AND COALESCE(finalize_attempts, 0) < 12
       AND (checkout_state <> 'finalizing' OR updated_at < now() - interval '10 minutes')
     ORDER BY updated_at ASC LIMIT 25`,
  );
  let completed = 0;
  const errors: string[] = [];
  for (const attempt of attempts.rows) {
    try {
      await finalize(app, commerce, attempt.correlation_id);
      completed += 1;
    } catch {
      errors.push(`${attempt.correlation_id}:finalization_failed`);
    }
  }
  return { ok: true, processed: attempts.rows.length, completed, errors };
}

export async function runReservationExpirySweep(app: WorkerDatabaseClient): Promise<{ processed: number; expired: number }> {
  const tenants = await app.query<{ tenant_id: string }>(
    `SELECT DISTINCT tenant_id FROM public.inventory_reservations
     WHERE status='active' AND expires_at IS NOT NULL AND expires_at <= now()
     ORDER BY tenant_id LIMIT 1000`,
  );
  let expired = 0;
  for (const row of tenants.rows) {
    expired += await expireDueReservations(app, createCommerceJob("inventory-reservation-expiry", { tenantId: row.tenant_id, limit: 5000 }));
  }
  return { processed: tenants.rows.length, expired };
}

export async function runBackInStockSweep(
  app: WorkerDatabaseClient,
  commerce: WorkerDatabaseClient,
  env: WorkerCronEnv,
  fetcher: typeof fetch = fetch,
): Promise<{ ok: true; inspected: number; sent: number; failed: number }> {
  const subscriptions = await app.query<{ id: string; email: string; product_id: string; product_slug: string; variant_id: string | null }>(
    `SELECT id::text, email, product_id, product_slug, variant_id
     FROM public.back_in_stock_notifications
     WHERE notified = false AND product_slug IS NOT NULL
     ORDER BY created_at ASC LIMIT 100`,
  );
  let sent = 0;
  let failed = 0;
  const productAvailability = new Map<string, Set<string>>();
  for (const subscription of subscriptions.rows) {
    const key = `${subscription.product_id}:${subscription.product_slug}`;
    let availableVariants = productAvailability.get(key);
    if (!availableVariants) {
      const response = await handleCatalogProductRequest(
        new Request(`https://worker/store/products/${encodeURIComponent(subscription.product_slug)}`),
        commerce,
        subscription.product_slug,
      );
      if (!response.ok) continue;
      const result = await response.json() as { product?: { id?: string; variants?: Array<Record<string, unknown>> } };
      if (result.product?.id !== subscription.product_id) continue;
      availableVariants = new Set((result.product.variants ?? [])
        .filter((variant) => Number(variant.inventory_quantity) > 0)
        .map((variant) => String(variant.id ?? ""))
        .filter(Boolean));
      productAvailability.set(key, availableVariants);
    }
    if (!availableVariants.size || subscription.variant_id && !availableVariants.has(subscription.variant_id)) continue;

    const idempotencyKey = `back_in_stock:${subscription.id}`;
    const existing = await app.query<{ id: string; status: string }>(
      `INSERT INTO public.public_delivery_attempts
         (delivery_kind, aggregate_id, recipient, provider, idempotency_key, status)
       VALUES ('back_in_stock', $1, $2, 'resend', $3, 'queued')
       ON CONFLICT (idempotency_key) DO UPDATE SET recipient = EXCLUDED.recipient
       RETURNING id::text, status`,
      [subscription.id, subscription.email, idempotencyKey],
    );
    const attempt = existing.rows[0];
    if (!attempt || attempt.status === "sent" || attempt.status === "suppressed") continue;
    const claim = await app.query<{ id: string; attempts: number }>(
      `UPDATE public.public_delivery_attempts
       SET status='retry',attempts=attempts+1,last_attempt_at=now(),next_attempt_at=now()+interval '2 minutes'
       WHERE id=$1 AND status IN ('queued','retry','failed') AND attempts < 8
         AND (next_attempt_at IS NULL OR next_attempt_at <= now())
       RETURNING id::text, attempts`,
      [attempt.id],
    );
    if (!claim.rows[0]) continue;

    const unsubscribe = await app.query<{ found: boolean }>(
      `SELECT EXISTS(SELECT 1 FROM public.marketing_preferences
       WHERE lower(email)=lower($1) AND channel='email' AND consent_status='unsubscribed') AS found`,
      [subscription.email],
    );
    if (unsubscribe.rows[0]?.found) {
      await app.query("UPDATE public.public_delivery_attempts SET status='suppressed',suppression_reason='recipient_unsubscribed' WHERE id=$1", [attempt.id]);
      await app.query("UPDATE public.back_in_stock_notifications SET notified=true,notified_at=now() WHERE id=$1 AND notified=false", [subscription.id]);
      continue;
    }
    if (!env.RESEND_API_KEY?.trim()) throw new Error("resend_not_configured");
    const productUrl = `${(env.PUBLIC_SITE_URL || "https://universalmusic.vercel.app").replace(/\/$/, "")}/shop/${encodeURIComponent(subscription.product_slug)}`;
    try {
      const response = await fetcher("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY.trim()}`, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({
          from: env.RESEND_FROM_EMAIL?.trim() || env.RESEND_FROM?.trim() || "noreply@universal-music-store.com",
          to: [subscription.email],
          subject: "An item you wanted is back in stock",
          html: `<p>${subscription.product_slug} is back in stock.</p><p><a href="${productUrl}">Shop now</a></p>`,
        }),
      });
      const payload = await response.json().catch(() => ({})) as { id?: unknown; message?: unknown };
      if (!response.ok || typeof payload.id !== "string") throw new Error("resend_rejected");
      await app.query("UPDATE public.public_delivery_attempts SET status='sent',provider_message_id=$2,sent_at=now(),last_error=NULL,next_attempt_at=NULL,last_attempt_at=now() WHERE id=$1", [attempt.id, payload.id]);
      await app.query("UPDATE public.back_in_stock_notifications SET notified=true,notified_at=now() WHERE id=$1 AND notified=false", [subscription.id]);
      sent += 1;
    } catch {
      await app.query("UPDATE public.public_delivery_attempts SET status=CASE WHEN attempts >= 8 THEN 'failed' ELSE 'retry' END,last_error='provider_request_failed',next_attempt_at=CASE WHEN attempts >= 8 THEN NULL ELSE now()+interval '5 minutes' END WHERE id=$1", [attempt.id]);
      failed += 1;
    }
  }
  return { ok: true, inspected: subscriptions.rows.length, sent, failed };
}

export async function handleWorkerCronRequest(request: Request, env: WorkerCronEnv): Promise<Response> {
  if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
  const configured = env.CRON_SECRET?.trim();
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim()
    || request.headers.get("x-cron-secret")?.trim() || "";
  if (!configured || !provided || !(await equalSecret(configured, provided))) return json({ error: "unauthorized" }, 401);
  const task = new URL(request.url).pathname.match(/^\/internal\/cron\/([a-z-]+)$/)?.[1];
  try {
    if (task === "inventory-reservations") {
      return await withWorkerDatabase(env, async (app) => json(await runReservationExpirySweep(app)), "app");
    }
    if (task === "back-in-stock") {
      if (!env.RESEND_API_KEY?.trim()) return json({ error: "back_in_stock_delivery_not_configured" }, 503);
      return await withWorkerDatabase(env, async (app) =>
        withWorkerDatabase(env, async (commerce) => json(await runBackInStockSweep(app, commerce, env)), "medusa"), "app");
    }
    if (task === "campaigns") {
      return await withWorkerDatabase(env, async (app) => json(await runCampaignSweep(app, env)), "app");
    }
    if (task === "payment-reconciliation") {
      return await withWorkerDatabase(env, async (app) => json(await runPaymentReconciliationSweep(app, env)), "app");
    }
    if (task === "media-storage-cleanup") {
      return await withWorkerDatabase(env, async (app) => json(await runMediaStorageCleanupSweep(app, env, env.fetch)), "app");
    }
    if (task === "finalize-payment-attempts") {
      return await withWorkerDatabase(env, async (app) =>
        withWorkerDatabase(env, async (commerce) => json(await runPaymentFinalizationSweep(app, commerce)), "medusa"), "app");
    }
    return json({ error: "cron_task_not_found" }, 404);
  } catch {
    return json({ error: "cron_task_unavailable" }, 503);
  }
}
