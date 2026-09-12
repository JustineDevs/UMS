import type { WorkerDatabaseClient } from "./database.ts";

type PaymentAttemptRow = {
  correlation_id: string;
  cart_id: string;
  provider: string;
  provider_session_id: string | null;
  provider_payment_id: string | null;
  status: string;
  checkout_state: string;
  quote_fingerprint: string | null;
  stale_reason: string | null;
  medusa_order_id: string | null;
  last_error: string | null;
  finalize_attempts: number;
  updated_at: string;
};

export type PaymentAttemptEnv = {
  TRACKING_HMAC_SECRET?: string;
  TRACKING_HMAC_KEY_VERSION?: string;
  STOREFRONT_PUBLIC_URL?: string;
};

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

function cookie(request: Request, name: string): string | null {
  const header = request.headers.get("Cookie") ?? "";
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim()) || null;
    } catch {
      return null;
    }
  }
  return null;
}

function publicError(value: string | null): string | null {
  if (!value?.trim()) return null;
  const normalized = value.toLowerCase();
  if (normalized.includes("quote") || normalized.includes("stale"))
    return "Your checkout quote changed. Review your bag before trying again.";
  if (
    ["provider", "payment", "stripe", "paypal", "xendit"].some((term) =>
      normalized.includes(term),
    )
  )
    return "Payment could not be verified. Try again or contact support.";
  if (["order", "medusa"].some((term) => normalized.includes(term)))
    return "Your order is still being finalized. Try again shortly.";
  return "Checkout needs review. Try again or contact support.";
}

function base64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function buildTrackingUrl(
  orderId: string | null,
  env: PaymentAttemptEnv,
): Promise<string | null> {
  const secret = env.TRACKING_HMAC_SECRET?.trim();
  if (!orderId?.trim() || !secret) return null;
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + 60 * 60 * 24 * 7;
  const keyVersion = env.TRACKING_HMAC_KEY_VERSION?.trim() || "v1";
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(secret),
  );
  const key = await crypto.subtle.importKey(
    "raw",
    digest,
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = JSON.stringify({
    version: "v3",
    purpose: "track",
    audience: "public-tracking",
    keyVersion,
    id: orderId.trim(),
    issuedAt,
    expiresAt,
  });
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, tagLength: 128 },
      key,
      new TextEncoder().encode(plaintext),
    ),
  );
  const tag = encrypted.slice(-16);
  const ciphertext = encrypted.slice(0, -16);
  const token = [
    "v3",
    keyVersion,
    issuedAt,
    expiresAt,
    base64Url(iv),
    base64Url(tag),
    base64Url(ciphertext),
  ].join(".");
  const origin = (
    env.STOREFRONT_PUBLIC_URL?.trim() || "https://universalmusic.vercel.app"
  ).replace(/\/$/, "");
  return `${origin}/track/cap_${encodeURIComponent(token)}`;
}

export async function handlePaymentAttemptRequest(
  request: Request,
  database: WorkerDatabaseClient,
  correlationId: string,
  env: PaymentAttemptEnv = {},
): Promise<Response> {
  if (request.method !== "GET")
    return json({ error: "method_not_allowed" }, 405);
  const id = correlationId.trim();
  if (!UUID.test(id)) return json({ error: "missing_correlation_id" }, 400);
  const result = await database.query<PaymentAttemptRow>(
    `SELECT correlation_id, cart_id, provider, provider_session_id, provider_payment_id,
            status, checkout_state, quote_fingerprint, stale_reason, medusa_order_id,
            last_error, finalize_attempts, updated_at
     FROM public.payment_attempts WHERE correlation_id = $1::uuid`,
    [id],
  );
  const row = result.rows[0];
  if (!row) return json({ error: "not_found" }, 404);
  const cartId = cookie(request, "mcart_id");
  const attemptCookie = cookie(request, "checkout_attempt_id");
  if (cartId !== row.cart_id && attemptCookie !== id)
    return json({ error: "not_found" }, 404);
  return json({
    correlationId: row.correlation_id,
    cartId: row.cart_id,
    provider: row.provider,
    providerSessionId: row.provider_session_id,
    providerPaymentId: row.provider_payment_id,
    status: row.status,
    checkoutState: row.checkout_state,
    quoteFingerprint: row.quote_fingerprint,
    staleReason: row.stale_reason,
    medusaOrderId: row.medusa_order_id,
    trackingPageUrl: await buildTrackingUrl(row.medusa_order_id, env),
    lastError: publicError(row.last_error),
    finalizeAttempts: row.finalize_attempts,
    updatedAt: row.updated_at,
  });
}
