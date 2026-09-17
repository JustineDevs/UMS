import { withWorkerTransaction, type WorkerDatabaseClient, type WorkerDatabaseEnv } from "./database.ts";
import { createCommerceJob, enqueueCommerceJob, type WorkerQueue } from "./queue.ts";
import { handleCatalogProductRequest } from "./catalog.ts";

type PublicMarketingEnv = WorkerDatabaseEnv & {
  DEFAULT_ORGANIZATION_ID?: string;
  PUBLIC_SITE_URL?: string;
  NEXT_PUBLIC_SITE_URL?: string;
  COMMERCE_QUEUE?: WorkerQueue;
  RECAPTCHA_SECRET_KEY?: string;
  RECAPTCHA_PROVIDER?: string;
  NEXT_PUBLIC_RECAPTCHA_PROVIDER?: string;
  RECAPTCHA_PROJECT_ID?: string;
  RECAPTCHA_ENTERPRISE_API_KEY?: string;
  NEXT_PUBLIC_RECAPTCHA_SITE_KEY?: string;
  RECAPTCHA_MIN_SCORE?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function json(body: unknown, status = 200, extra?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...extra },
  });
}

function email(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return normalized.length <= 320 && EMAIL_RE.test(normalized) ? normalized : null;
}

async function body(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const value: unknown = await request.json();
    return value && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function verifyRecaptcha(request: Request, tokenValue: unknown, env: PublicMarketingEnv): Promise<boolean> {
  if (typeof tokenValue !== "string" || tokenValue.length < 20 || tokenValue.length > 4096) return false;
  const provider = (env.NEXT_PUBLIC_RECAPTCHA_PROVIDER || env.RECAPTCHA_PROVIDER || "enterprise").trim().toLowerCase();
  const minimum = Number(env.RECAPTCHA_MIN_SCORE);
  const minimumScore = Number.isFinite(minimum) && minimum >= 0 && minimum <= 1 ? minimum : 0.3;
  try {
    if (provider === "standard") {
      if (!env.RECAPTCHA_SECRET_KEY?.trim()) return false;
      const payload = new URLSearchParams({ secret: env.RECAPTCHA_SECRET_KEY.trim(), response: tokenValue });
      const response = await fetch("https://www.google.com/recaptcha/api/siteverify", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: payload });
      const result = await response.json() as { success?: boolean; score?: number; action?: string };
      return response.ok && result.success === true && result.action?.toLowerCase() === "signup" && Number(result.score ?? 0) >= minimumScore;
    }
    const projectId = env.RECAPTCHA_PROJECT_ID?.trim();
    const apiKey = env.RECAPTCHA_ENTERPRISE_API_KEY?.trim();
    const siteKey = env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.trim();
    if (!projectId || !apiKey || !siteKey) return false;
    const response = await fetch(`https://recaptchaenterprise.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/assessments?key=${encodeURIComponent(apiKey)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event: { token: tokenValue, siteKey, expectedAction: "signup", userAgent: request.headers.get("user-agent") || undefined, userIpAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined } }) });
    const result = await response.json() as { tokenProperties?: { valid?: boolean; action?: string }; riskAnalysis?: { score?: number } };
    return response.ok && result.tokenProperties?.valid === true && result.tokenProperties.action?.toLowerCase() === "signup" && Number(result.riskAnalysis?.score ?? 0) >= minimumScore;
  } catch {
    return false;
  }
}

function token(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export async function handleNewsletterRequest(
  request: Request,
  database: WorkerDatabaseClient,
  env: PublicMarketingEnv,
): Promise<Response> {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405, { Allow: "POST" });
  const input = await body(request);
  const subscriber = email(input?.email);
  if (!subscriber) return json({ error: "valid_email_required" }, 400);
  if (!(await verifyRecaptcha(request, input?.recaptchaToken, env))) return json({ error: "verification_failed" }, 400);

  const organizationId = env.DEFAULT_ORGANIZATION_ID?.trim() || null;
  const rawToken = token();
  const confirmation = await withWorkerTransaction(database, async (tx) => {
    const inserted = await tx.query<{ id: string }>(
      `INSERT INTO public.newsletter_confirmations (organization_id, email, token_hash, expires_at)
       VALUES ($1, $2, $3, now() + interval '24 hours') RETURNING id`,
      [organizationId, subscriber, await sha256(rawToken)],
    );
    const id = inserted.rows[0]?.id;
    if (!id) throw new Error("newsletter_confirmation_not_created");
    const delivery = await tx.query<{ id: string }>(
      `INSERT INTO public.public_delivery_attempts
         (organization_id, delivery_kind, aggregate_id, recipient, provider, idempotency_key, status)
       VALUES ($1, 'newsletter_confirmation', $2, $3, 'resend', $4, 'queued')
       ON CONFLICT (idempotency_key) DO UPDATE SET recipient = EXCLUDED.recipient
       RETURNING id`,
      [organizationId, id, subscriber, `newsletter-confirmation:${id}`],
    );
    return { id, attemptId: delivery.rows[0]?.id };
  });
  if (!confirmation.attemptId) return json({ error: "subscription_unavailable" }, 503);

  if (env.COMMERCE_QUEUE) {
    const origin = (env.PUBLIC_SITE_URL || env.NEXT_PUBLIC_SITE_URL || "").trim().replace(/\/$/, "");
    const confirmUrl = `${origin}/api/newsletter/confirm?token=${encodeURIComponent(rawToken)}`;
    await enqueueCommerceJob(env.COMMERCE_QUEUE, createCommerceJob("notification-delivery", {
      attemptId: confirmation.attemptId,
      recipient: subscriber,
      subject: "Confirm your newsletter subscription",
      html: `<p>Confirm your subscription to receive updates.</p><p><a href="${confirmUrl}">Confirm subscription</a></p><p>This link expires in 24 hours.</p>`,
    }));
  }
  return json({ ok: true });
}

export async function handleNewsletterConfirmRequest(
  request: Request,
  database: WorkerDatabaseClient,
): Promise<Response> {
  if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405, { Allow: "GET" });
  const rawToken = new URL(request.url).searchParams.get("token")?.trim() || "";
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(rawToken)) return json({ error: "invalid_confirmation_link" }, 400);
  const hash = await sha256(rawToken);
  const result = await withWorkerTransaction(database, async (tx) => {
    const found = await tx.query<{ id: string; organization_id: string | null; email: string; expires_at: string; confirmed_at: string | null }>(
      `SELECT id, organization_id, email, expires_at, confirmed_at FROM public.newsletter_confirmations
       WHERE token_hash = $1 FOR UPDATE`, [hash],
    );
    const confirmation = found.rows[0];
    if (!confirmation || confirmation.confirmed_at || Date.parse(confirmation.expires_at) <= Date.now()) return null;
    const now = new Date().toISOString();
    const preference = await tx.query<{ consent_status: string }>(
      `SELECT consent_status FROM public.marketing_preferences WHERE organization_id IS NOT DISTINCT FROM $1
       AND email = $2 AND channel = 'email'`, [confirmation.organization_id, confirmation.email],
    );
    if (preference.rows[0]?.consent_status === "unsubscribed") {
      await tx.query("UPDATE public.newsletter_confirmations SET confirmed_at = $2 WHERE id = $1", [confirmation.id, new Date().toISOString()]);
      return { ok: true, suppressed: true };
    }
    await tx.query(
      `UPDATE public.marketing_preferences SET consent_status = 'subscribed', source = 'newsletter-confirmation',
       consented_at = $3, unsubscribed_at = NULL, updated_at = $3
       WHERE organization_id IS NOT DISTINCT FROM $1 AND email = $2 AND channel = 'email'`,
      [confirmation.organization_id, confirmation.email, now],
    );
    if (!preference.rows[0]) {
      await tx.query(
        `INSERT INTO public.marketing_preferences (organization_id, email, channel, consent_status, source, consented_at, updated_at)
         VALUES ($1, $2, 'email', 'subscribed', 'newsletter-confirmation', $3, $3)
         ON CONFLICT (organization_id, email, channel) DO NOTHING`,
        [confirmation.organization_id, confirmation.email, now],
      );
    }
    await tx.query("UPDATE public.newsletter_confirmations SET confirmed_at = $2 WHERE id = $1", [confirmation.id, now]);
    return { ok: true };
  });
  return result ? json(result) : json({ error: "confirmation_link_invalid_or_expired" }, 400);
}

export async function handleNewsletterUnsubscribeRequest(
  request: Request,
  database: WorkerDatabaseClient,
  env: PublicMarketingEnv,
): Promise<Response> {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405, { Allow: "POST" });
  const input = await body(request);
  const subscriber = email(input?.email);
  if (!subscriber) return json({ error: "valid_email_required" }, 400);
  const organizationId = env.DEFAULT_ORGANIZATION_ID?.trim() || null;
  const now = new Date().toISOString();
  await database.query(
    `INSERT INTO public.marketing_preferences (organization_id, email, channel, consent_status, source, unsubscribed_at, updated_at)
     VALUES ($1, $2, 'email', 'unsubscribed', 'unsubscribe', $3, $3)
     ON CONFLICT (organization_id, email, channel) DO UPDATE SET consent_status = 'unsubscribed', source = 'unsubscribe', unsubscribed_at = $3, updated_at = $3`,
    [organizationId, subscriber, now],
  );
  return json({ ok: true });
}

export async function handleBackInStockRequest(
  request: Request,
  appDatabase: WorkerDatabaseClient,
  medusaDatabase: WorkerDatabaseClient,
): Promise<Response> {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405, { Allow: "POST" });
  const input = await body(request);
  const subscriber = email(input?.email);
  const productId = typeof input?.productId === "string" ? input.productId.trim() : "";
  const productSlug = typeof input?.productSlug === "string" ? input.productSlug.trim() : "";
  const variantId = typeof input?.variantId === "string" ? input.variantId.trim() : null;
  if (!subscriber || !productId || !productSlug || productId.length > 120 || productSlug.length > 180 || variantId && variantId.length > 120) {
    return json({ error: "invalid_payload" }, 400);
  }
  const productResponse = await handleCatalogProductRequest(new Request(`https://worker/store/products/${encodeURIComponent(productSlug)}`), medusaDatabase, productSlug);
  if (!productResponse.ok) return json({ error: productResponse.status === 404 ? "product_not_found" : "catalog_unavailable" }, productResponse.status === 404 ? 404 : 503);
  const product = await productResponse.json() as { product?: { id?: string; variants?: Array<{ id?: string }> } };
  if (product.product?.id !== productId) return json({ error: "product_not_found" }, 404);
  if (variantId && !product.product.variants?.some((variant) => variant.id === variantId)) return json({ error: "variant_not_found" }, 404);
  await appDatabase.query(
    `INSERT INTO public.back_in_stock_notifications (email, product_id, product_slug, variant_id, notified, created_at)
     VALUES ($1, $2, $3, $4, false, now())
     ON CONFLICT (email, product_id, variant_id) DO UPDATE SET notified = false, notified_at = NULL`,
    [subscriber, productId, productSlug, variantId],
  );
  return json({ ok: true });
}
