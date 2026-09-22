import type { WorkerDatabaseClient } from "./database.ts";
import { withWorkerTransaction } from "./database.ts";
import { getCartById } from "./cart.ts";
import { handleCheckoutPreviewRequest } from "./checkout.ts";
import { majorToMinor } from "./money.ts";

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
  DEFAULT_ORGANIZATION_ID?: string;
};

type OpenPaymentAttempt = {
  correlation_id: string;
  cart_id?: string;
  provider?: string;
  quote_fingerprint: string | null;
  provider_payload: Record<string, unknown> | null;
  quote_version: number | null;
};

function response(
  body: Record<string, unknown>,
  status = 200,
  headers?: ConstructorParameters<typeof Headers>[0],
): Response {
  const resultHeaders = new Headers(headers);
  resultHeaders.set("Content-Type", "application/json");
  resultHeaders.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(body), { status, headers: resultHeaders });
}

function readCookie(request: Request, name: string): string | null {
  for (const part of (request.headers.get("Cookie") ?? "").split(";")) {
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

/** Registers a cart-bound attempt using the current Worker-owned catalog quote. */
export async function handlePaymentAttemptRegistrationRequest(
  request: Request,
  appDatabase: WorkerDatabaseClient,
  commerceDatabase: WorkerDatabaseClient,
  env: PaymentAttemptEnv = {},
): Promise<Response> {
  if (request.method !== "POST")
    return response({ error: "method_not_allowed" }, 405);
  const contentLength = Number(request.headers.get("Content-Length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > 16 * 1024) {
    return response({ error: "request_too_large" }, 413);
  }
  let raw: string;
  let input: unknown;
  try {
    raw = await request.text();
    if (raw.length > 16 * 1024)
      return response({ error: "request_too_large" }, 413);
    input = JSON.parse(raw);
  } catch {
    return response({ error: "invalid_json" }, 400);
  }
  if (!input || typeof input !== "object" || Array.isArray(input))
    return response({ error: "invalid_checkout_intent" }, 400);
  const body = input as Record<string, unknown>;
  const cartId = typeof body.cartId === "string" ? body.cartId.trim() : "";
  const provider = body.provider;
  const quoteFingerprint =
    typeof body.quoteFingerprint === "string"
      ? body.quoteFingerprint.trim()
      : "";
  if (
    !cartId ||
    cartId.length > 255 ||
    readCookie(request, "mcart_id") !== cartId
  )
    return response({ error: "cart_mismatch" }, 403);
  if (!["cod", "stripe", "paypal", "xendit"].includes(String(provider)))
    return response({ error: "invalid_provider" }, 400);
  if (!/^[a-f0-9]{64}$/i.test(quoteFingerprint))
    return response({ error: "invalid_quote_fingerprint" }, 400);
  for (const field of [
    "medusaPaymentSessionId",
    "providerSessionId",
    "providerPaymentId",
    "idempotencyKey",
  ] as const) {
    const value = body[field];
    if (
      value !== undefined &&
      (typeof value !== "string" || value.length > 200)
    ) {
      return response({ error: "invalid_checkout_intent" }, 400);
    }
  }

  const cart = await getCartById(cartId, commerceDatabase);
  const lines = Array.isArray(cart?.items)
    ? cart.items.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const row = item as Record<string, unknown>;
        return typeof row.variant_id === "string" &&
          Number.isSafeInteger(row.quantity) &&
          Number(row.quantity) > 0
          ? [{ variantId: row.variant_id, quantity: Number(row.quantity) }]
          : [];
      })
    : [];
  if (!lines.length) return response({ error: "cart_empty_or_expired" }, 409);
  const previewResponse = await handleCheckoutPreviewRequest(
    new Request("https://worker.internal/store/checkout/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lines }),
    }),
    commerceDatabase,
  );
  const preview = (await previewResponse.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (
    !previewResponse.ok ||
    !preview ||
    preview.quoteFingerprint !== quoteFingerprint
  )
    return response({ error: "quote_changed" }, 409);
  const currency =
    typeof preview.currencyCode === "string"
      ? preview.currencyCode.toLowerCase()
      : "";
  const amountMinor =
    typeof preview.total === "number"
      ? majorToMinor(preview.total, currency)
      : NaN;
  if (
    !/^[a-z]{3}$/.test(currency) ||
    !Number.isSafeInteger(amountMinor) ||
    amountMinor < 1
  )
    return response({ error: "invalid_checkout_total" }, 409);

  const organizationId = env.DEFAULT_ORGANIZATION_ID?.trim() || null;
  const idempotencyKey =
    typeof body.idempotencyKey === "string"
      ? body.idempotencyKey.trim() || null
      : null;
  if (
    idempotencyKey &&
    (idempotencyKey.length < 8 || idempotencyKey.length > 200)
  ) {
    return response({ error: "invalid_idempotency_key" }, 400);
  }
  const correlationId = crypto.randomUUID();
  const quotePayload = JSON.stringify({
    quote: {
      fingerprint: quoteFingerprint,
      variant_ids: Array.isArray(preview.variantIds) ? preview.variantIds : [],
      product_ids: Array.isArray(preview.productIds) ? preview.productIds : [],
    },
  });
  let reused = false;
  let idempotencyConflict = false;
  let resultCorrelationId: string = correlationId;
  try {
    await withWorkerTransaction(appDatabase, async (transaction) => {
      await transaction.query(
        "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
        [`${cartId}:${provider}`],
      );
      if (idempotencyKey && organizationId) {
        await transaction.query(
          "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
          [`${organizationId}:${idempotencyKey}`],
        );
        const replay = await transaction.query<OpenPaymentAttempt>(
          `SELECT correlation_id, cart_id, provider, quote_fingerprint
             FROM public.payment_attempts
            WHERE organization_id = $1 AND idempotency_key = $2
            LIMIT 1 FOR UPDATE`,
          [organizationId, idempotencyKey],
        );
        if (replay.rows[0]) {
          const prior = replay.rows[0];
          if (
            prior.cart_id !== cartId ||
            prior.provider !== provider ||
            prior.quote_fingerprint !== quoteFingerprint
          ) {
            idempotencyConflict = true;
            return;
          }
          reused = true;
          resultCorrelationId = prior.correlation_id;
          return;
        }
      }
      const existingResult = await transaction.query<OpenPaymentAttempt>(
        `SELECT correlation_id, quote_fingerprint, provider_payload, quote_version
           FROM public.payment_attempts
          WHERE cart_id = $1 AND provider = $2
            AND status NOT IN ('completed', 'cancelled', 'expired', 'failed', 'refunded')
          ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
        [cartId, provider],
      );
      const existing = existingResult.rows[0];
      if (existing && existing.quote_fingerprint === quoteFingerprint) {
        await transaction.query(
          `UPDATE public.payment_attempts
              SET amount_minor = $1, currency = $2, quote_fingerprint = $3,
                  stale_reason = NULL, invalidated_at = NULL, invalidated_by = NULL,
                  provider_payload = COALESCE(provider_payload, '{}'::jsonb) || $4::jsonb,
                  organization_id = COALESCE($5, organization_id),
                  medusa_payment_session_id = COALESCE($6, medusa_payment_session_id),
                  provider_session_id = COALESCE($7, provider_session_id),
                  provider_payment_id = COALESCE($8, provider_payment_id),
                  idempotency_key = COALESCE($9, idempotency_key), updated_at = now()
            WHERE correlation_id = $10::uuid`,
          [
            amountMinor,
            currency,
            quoteFingerprint,
            quotePayload,
            organizationId,
            body.medusaPaymentSessionId ?? null,
            body.providerSessionId ?? null,
            body.providerPaymentId ?? null,
            idempotencyKey,
            existing.correlation_id,
          ],
        );
        reused = true;
        resultCorrelationId = existing.correlation_id;
        return;
      }
      if (existing) {
        await transaction.query(
          `UPDATE public.payment_attempts
              SET status = 'expired', checkout_state = 'needs_review', stale_reason = 'quote_changed',
                  invalidated_at = now(), invalidated_by = 'quote_fingerprint',
                  last_error = 'Your checkout total changed. Review the updated order before paying.', updated_at = now()
            WHERE correlation_id = $1::uuid`,
          [existing.correlation_id],
        );
      }
      await transaction.query(
        `INSERT INTO public.payment_attempts
           (correlation_id, organization_id, cart_id, provider, status, checkout_state,
            amount_minor, currency, quote_fingerprint, quote_version, medusa_payment_session_id,
            provider_session_id, provider_payment_id, idempotency_key, provider_payload, updated_at)
         VALUES ($1::uuid, $2, $3, $4, 'initiated', 'awaiting_provider', $5, $6, $7, 1,
                 $8, $9, $10, $11, $12::jsonb, now())`,
        [
          correlationId,
          organizationId,
          cartId,
          provider,
          amountMinor,
          currency,
          quoteFingerprint,
          typeof body.medusaPaymentSessionId === "string"
            ? body.medusaPaymentSessionId.slice(0, 200)
            : null,
          typeof body.providerSessionId === "string"
            ? body.providerSessionId.slice(0, 200)
            : null,
          typeof body.providerPaymentId === "string"
            ? body.providerPaymentId.slice(0, 200)
            : null,
          idempotencyKey,
          quotePayload,
        ],
      );
    });
  } catch {
    return response({ error: "payment_attempt_unavailable" }, 503);
  }
  if (idempotencyConflict)
    return response({ error: "idempotency_key_reused" }, 409);
  return response({ correlationId: resultCorrelationId, cartId, reused }, 200, {
    "Set-Cookie": `checkout_attempt_id=${encodeURIComponent(resultCorrelationId)}; Path=/; Max-Age=900; HttpOnly; Secure; SameSite=Lax`,
  });
}

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

const OPEN_ATTEMPT_STATUSES = [
  "initiated",
  "pending_payment",
  "pending_capture",
  "paid",
  "authorized",
  "pending_provider_redirect",
  "paid_awaiting_order",
  "finalizing_order",
  "awaiting_completion",
  "needs_review",
] as const;

/** Recovers an attempt only through the current cart or short-lived attempt capability. */
export async function handlePaymentAttemptRecoveryRequest(
  request: Request,
  database: WorkerDatabaseClient,
): Promise<Response> {
  if (request.method !== "GET")
    return json({ error: "method_not_allowed" }, 405);
  const url = new URL(request.url);
  const provider = url.searchParams.get("provider")?.trim().toLowerCase() ?? "";
  if (!["stripe", "paypal", "xendit"].includes(provider))
    return json({ error: "invalid_provider" }, 400);
  const cartId = cookie(request, "mcart_id");
  const attemptCookie = cookie(request, "checkout_attempt_id");
  const providerOrderId = url.searchParams.get("provider_order_id")?.trim() ?? "";
  if (!cartId && !attemptCookie) return json({ error: "checkout_capability_required" }, 401);
  if (attemptCookie && !UUID.test(attemptCookie))
    return json({ error: "not_found" }, 404);

  type RecoveryRow = {
    correlation_id: string;
    cart_id: string;
    provider: string;
    status: string;
    checkout_state: string;
    medusa_order_id: string | null;
  };
  let result: { rows: RecoveryRow[]; rowCount: number | null };
  if (cartId && providerOrderId) {
    if (providerOrderId.length > 500) return json({ error: "invalid_provider_order_id" }, 400);
    result = await database.query<RecoveryRow>(
      `SELECT correlation_id, cart_id, provider, status, checkout_state, medusa_order_id
       FROM public.payment_attempts
       WHERE cart_id = $1 AND provider = $2
         AND (provider_session_id = $3 OR provider_payment_id = $3)
       ORDER BY created_at DESC LIMIT 1`,
      [cartId, provider, providerOrderId],
    );
  } else if (cartId) {
    result = await database.query<RecoveryRow>(
      `SELECT correlation_id, cart_id, provider, status, checkout_state, medusa_order_id
       FROM public.payment_attempts
       WHERE cart_id = $1 AND provider = $2 AND status = ANY($3::text[])
       ORDER BY created_at DESC LIMIT 1`,
      [cartId, provider, OPEN_ATTEMPT_STATUSES],
    );
  } else {
    result = await database.query<RecoveryRow>(
      `SELECT correlation_id, cart_id, provider, status, checkout_state, medusa_order_id
       FROM public.payment_attempts
       WHERE correlation_id = $1::uuid AND provider = $2
       LIMIT 1`,
      [attemptCookie, provider],
    );
  }
  const row = result.rows[0];
  if (!row || (cartId && row.cart_id !== cartId)) return json({ found: false });
  return json({
    found: true,
    correlationId: row.correlation_id,
    status: row.status,
    checkoutState: row.checkout_state,
    medusaOrderId: row.medusa_order_id,
  });
}
