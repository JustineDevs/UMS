import type { WorkerDatabaseClient } from "./database.ts";
import {
  executeIdempotently,
  HyperdriveIdempotencyStore,
} from "./idempotency.ts";
import {
  createPayPalOrder,
  createStripeCheckoutSession,
  createXenditSession,
  type HostedCheckoutResult,
} from "./providers.ts";
import { formatMajorAmount, minorToMajor } from "./money.ts";

type CheckoutRow = {
  cart_id: string;
  currency_code: string;
  quantity: number;
  unit_price: string | number;
  discount_total?: string | number | null;
};

type PreviewRow = {
  variant_id: string;
  product_id: string;
  title: string;
  status: string;
  amount: string | number | null;
  currency_code: string | null;
};
export type CheckoutProvider = "stripe" | "paypal" | "xendit";
export type CheckoutEnv = {
  STRIPE_API_KEY?: string;
  PAYPAL_CLIENT_ID?: string;
  PAYPAL_CLIENT_SECRET?: string;
  PAYPAL_ENVIRONMENT?: string;
  XENDIT_SECRET_KEY?: string;
};

export function checkoutAttemptCookie(correlationId: string): string {
  return `checkout_attempt_id=${encodeURIComponent(correlationId)}; Path=/; Max-Age=900; HttpOnly; Secure; SameSite=Lax`;
}

export async function readCheckoutTotals(
  cartId: string,
  database: WorkerDatabaseClient,
): Promise<{ currency: string; amountMinor: number } | null> {
  const result = await database.query<CheckoutRow>(
    `SELECT c.id AS cart_id, c.currency_code, i.quantity, i.unit_price,
            COALESCE((SELECT sum(a.amount)
                      FROM public.cart_line_item_adjustment a
                      WHERE a.item_id = i.id AND a.deleted_at IS NULL), 0) AS discount_total
     FROM public.cart c JOIN public.cart_line_item i ON i.cart_id = c.id AND i.deleted_at IS NULL
     WHERE c.id = $1 AND c.deleted_at IS NULL AND c.completed_at IS NULL`,
    [cartId],
  );
  if (result.rows.length === 0) return null;
  const amountMinor = result.rows.reduce(
    (total, row) => total + Math.max(0, Math.round(Number(row.unit_price) * row.quantity) - Math.round(Number(row.discount_total ?? 0))),
    0,
  );
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 1) return null;
  return { currency: result.rows[0].currency_code, amountMinor };
}

export async function handleCheckoutPreviewRequest(
  request: Request,
  database: WorkerDatabaseClient,
): Promise<Response> {
  if (request.method !== "POST") return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers: { "Content-Type": "application/json" } });
  let body: unknown;
  try { body = await request.json(); } catch { return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400, headers: { "Content-Type": "application/json" } }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return new Response(JSON.stringify({ error: "invalid_preview" }), { status: 400, headers: { "Content-Type": "application/json" } });
  const input = body as Record<string, unknown>;
  const rawLines = input.lines;
  if (!Array.isArray(rawLines) || rawLines.length === 0 || rawLines.length > 50) return new Response(JSON.stringify({ error: "lines_required" }), { status: 400, headers: { "Content-Type": "application/json" } });
  const lines = rawLines.map((line) => {
    if (!line || typeof line !== "object" || Array.isArray(line)) return null;
    const value = line as Record<string, unknown>;
    const variantId = typeof value.variantId === "string" ? value.variantId.trim() : "";
    const quantity = typeof value.quantity === "number" && Number.isSafeInteger(value.quantity) ? value.quantity : 0;
    return variantId && quantity > 0 && quantity <= 999 ? { variantId, quantity } : null;
  });
  if (lines.some((line) => !line)) return new Response(JSON.stringify({ error: "invalid_lines" }), { status: 400, headers: { "Content-Type": "application/json" } });
  const validLines = lines as Array<{ variantId: string; quantity: number }>;
  const ids = [...new Set(validLines.map((line) => line.variantId))];
  const result = await database.query<PreviewRow>(
    `SELECT v.id AS variant_id, v.product_id, p.title, p.status,
            (SELECT pr.amount FROM public.product_variant_price_set pvps
             JOIN public.price pr ON pr.price_set_id = pvps.price_set_id
             WHERE pvps.variant_id = v.id AND pvps.deleted_at IS NULL AND pr.deleted_at IS NULL
               AND (pr.min_quantity IS NULL OR pr.min_quantity <= 1)
               AND (pr.max_quantity IS NULL OR pr.max_quantity >= 1)
             ORDER BY CASE WHEN pr.currency_code = 'php' THEN 0 ELSE 1 END, pr.amount ASC
             LIMIT 1) AS amount,
            (SELECT pr.currency_code FROM public.product_variant_price_set pvps
             JOIN public.price pr ON pr.price_set_id = pvps.price_set_id
             WHERE pvps.variant_id = v.id AND pvps.deleted_at IS NULL AND pr.deleted_at IS NULL
             ORDER BY CASE WHEN pr.currency_code = 'php' THEN 0 ELSE 1 END, pr.amount ASC
             LIMIT 1) AS currency_code
       FROM public.product_variant v
       JOIN public.product p ON p.id = v.product_id AND p.deleted_at IS NULL
      WHERE v.id = ANY($1::text[]) AND v.deleted_at IS NULL`,
    [ids],
  );
  const byVariant = new Map(result.rows.map((row) => [row.variant_id, row]));
  if (validLines.some((line) => !byVariant.has(line.variantId))) return new Response(JSON.stringify({ error: "variant_unavailable" }), { status: 409, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  const first = result.rows[0];
  if (!first || first.status !== "published" || !first.currency_code) return new Response(JSON.stringify({ error: "catalog_unavailable" }), { status: 503, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  const lineSubtotalsByVariantId: Record<string, number> = {};
  let subtotal = 0;
  for (const line of validLines) {
    const row = byVariant.get(line.variantId)!;
    const amount = Number(row.amount);
    if (!Number.isSafeInteger(amount) || amount < 0) return new Response(JSON.stringify({ error: "price_unavailable" }), { status: 503, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
    const lineTotal = amount * line.quantity;
    lineSubtotalsByVariantId[line.variantId] = minorToMajor(lineTotal, first.currency_code);
    subtotal += lineTotal;
  }
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify({ validLines, subtotal, currency: first.currency_code })));
  const quoteFingerprint = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return new Response(JSON.stringify({
    subtotal: minorToMajor(subtotal, first.currency_code),
    taxTotal: 0,
    shippingTotal: 0,
    discountTotal: 0,
    total: minorToMajor(subtotal, first.currency_code),
    currencyCode: first.currency_code.toUpperCase(),
    lineSubtotalsByVariantId,
    quoteFingerprint,
    variantIds: validLines.map((line) => line.variantId),
    productIds: validLines.map((line) => byVariant.get(line.variantId)!.product_id),
    shippingMethodIds: [],
    regionId: null,
    shippingOptions: [],
    appliedShippingOptionId: null,
  }), { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

export async function createHostedCheckout(
  provider: CheckoutProvider,
  totals: { currency: string; amountMinor: number },
  input: {
    successUrl: string;
    cancelUrl: string;
    idempotencyKey: string;
    correlationId?: string;
  },
  env: CheckoutEnv,
): Promise<HostedCheckoutResult> {
  if (provider === "stripe" && !env.STRIPE_API_KEY?.trim())
    throw new Error("stripe_not_configured");
  if (
    provider === "paypal" &&
    (!env.PAYPAL_CLIENT_ID?.trim() || !env.PAYPAL_CLIENT_SECRET?.trim())
  )
    throw new Error("paypal_not_configured");
  if (provider === "xendit" && !env.XENDIT_SECRET_KEY?.trim())
    throw new Error("xendit_not_configured");
  if (provider === "stripe")
    return createStripeCheckoutSession({
      secretKey: env.STRIPE_API_KEY ?? "",
      amountMinor: totals.amountMinor,
      currency: totals.currency,
      productName: "Universal Music Store order",
      quantity: 1,
      ...input,
    });
  if (provider === "paypal")
    return createPayPalOrder({
      clientId: env.PAYPAL_CLIENT_ID ?? "",
      clientSecret: env.PAYPAL_CLIENT_SECRET ?? "",
      sandbox: (env.PAYPAL_ENVIRONMENT ?? "sandbox") !== "production",
      amountMajor: formatMajorAmount(totals.amountMinor, totals.currency),
      currency: totals.currency,
      returnUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
      idempotencyKey: input.idempotencyKey,
      correlationId: input.correlationId,
    });
  return createXenditSession({
    secretKey: env.XENDIT_SECRET_KEY ?? "",
    referenceId: input.idempotencyKey,
    amountMinor: totals.amountMinor,
    currency: totals.currency,
    successUrl: input.successUrl,
    cancelUrl: input.cancelUrl,
    idempotencyKey: input.idempotencyKey,
    correlationId: input.correlationId,
  });
}

export async function handleCheckoutSessionRequest(
  request: Request,
  database: WorkerDatabaseClient,
  env: CheckoutEnv,
  appDatabase: WorkerDatabaseClient = database,
): Promise<Response> {
  if (request.method !== "POST")
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  const key = request.headers.get("Idempotency-Key")?.trim();
  if (!key)
    return new Response(JSON.stringify({ error: "idempotency_key_required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  const raw = await request.text();
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (!body || typeof body !== "object" || Array.isArray(body))
    return new Response(JSON.stringify({ error: "invalid_checkout" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  const input = body as Record<string, unknown>;
  const cartId = typeof input.cart_id === "string" ? input.cart_id.trim() : "";
  const provider = input.provider;
  const successUrl =
    typeof input.success_url === "string" ? input.success_url : "";
  const cancelUrl =
    typeof input.cancel_url === "string" ? input.cancel_url : "";
  const validCheckoutCallbackUrl = (value: string): boolean => {
    try {
      const url = new URL(value);
      const loopback =
        url.hostname === "localhost" ||
        url.hostname === "127.0.0.1" ||
        url.hostname === "[::1]";
      return (
        value.length <= 2048 &&
        (url.protocol === "https:" || (url.protocol === "http:" && loopback))
      );
    } catch {
      return false;
    }
  };
  const requiresHttpsCallback = (value: string): boolean => {
    try {
      return new URL(value).protocol === "https:";
    } catch {
      return false;
    }
  };
  if (
    !cartId ||
    (provider !== "stripe" && provider !== "paypal" && provider !== "xendit") ||
    !validCheckoutCallbackUrl(successUrl) ||
    !validCheckoutCallbackUrl(cancelUrl)
  )
    return new Response(JSON.stringify({ error: "invalid_checkout_urls" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  if (
    provider === "xendit" &&
    (!requiresHttpsCallback(successUrl) || !requiresHttpsCallback(cancelUrl))
  ) {
    return new Response(
      JSON.stringify({
        error:
          "Xendit requires an authenticated HTTPS callback URL for hosted checkout.",
        code: "XENDIT_HTTPS_CALLBACK_REQUIRED",
      }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      },
    );
  }
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(
      `${request.method}:${new URL(request.url).pathname}:${raw}`,
    ),
  );
  const requestHash = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  const result = await executeIdempotently(
    new HyperdriveIdempotencyStore(appDatabase),
    key,
    requestHash,
    async () => {
      const totals = await readCheckoutTotals(cartId, database);
      if (!totals)
        return new Response(
          JSON.stringify({ error: "cart_empty_or_expired" }),
          {
            status: 409,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-store",
            },
          },
        );
      const correlationId = crypto.randomUUID();
      let attemptCreated = false;
      try {
        await appDatabase.query(
          `INSERT INTO public.payment_attempts
             (correlation_id, cart_id, provider, amount_minor, currency, status, checkout_state, idempotency_key)
           VALUES ($1::uuid, $2, $3, $4, $5, 'initiated', 'awaiting_provider', $6)`,
          [
            correlationId,
            cartId,
            provider,
            totals.amountMinor,
            totals.currency,
            key,
          ],
        );
        attemptCreated = true;
        const checkout = await createHostedCheckout(
          provider,
          totals,
          { successUrl, cancelUrl, idempotencyKey: key, correlationId },
          env,
        );
        await appDatabase.query(
          `UPDATE public.payment_attempts
           SET provider_session_id = $1, updated_at = now()
           WHERE correlation_id = $2::uuid`,
          [checkout.id, correlationId],
        );
        return new Response(
          JSON.stringify({
            provider,
            checkout,
            amountMinor: totals.amountMinor,
            currency: totals.currency,
            correlationId,
          }),
          {
            status: 201,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-store",
              "Set-Cookie": checkoutAttemptCookie(correlationId),
            },
          },
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "checkout_provider_failed";
        if (attemptCreated) {
          await appDatabase.query(
            `UPDATE public.payment_attempts
             SET status = 'failed', checkout_state = 'needs_review', last_error = $1, updated_at = now()
             WHERE correlation_id = $2::uuid`,
            [message, correlationId],
          );
        }
        return new Response(JSON.stringify({ error: "checkout_provider_failed", code: "CHECKOUT_PROVIDER_FAILED" }), {
          status: 502,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
          },
        });
      }
    },
  );
  return result.response;
}
