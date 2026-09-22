import { NextResponse } from "next/server";
import type { CommerceAttribution } from "@universal-music-store/sdk";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { applyRateLimit, parseJsonBody } from "@/lib/cart-api-helpers";
import { readCartIdFromCookie } from "@/lib/cart-api-helpers";
import { PAYMENT_PROVIDER_IDS, type CheckoutLine } from "@/lib/checkout-worker";
import { minorUnitDivisor } from "@/lib/medusa-money";
import { isSameOriginMutation } from "@/lib/request-origin";
import { checkoutAttemptCookieHeader } from "@/lib/checkout-attempt-cookie";
import { resolveCheckoutEmail } from "@/lib/checkout-email";
import { readResponseJson } from "@/lib/read-response-json";
import { checkoutStartResponseSchema } from "@/lib/admin-api-contracts";
import { createWorkerCheckoutCart } from "@/lib/worker-checkout-cart";

export const dynamic = "force-dynamic";

type StartBody = {
  lines?: Array<{ variantId?: string; quantity?: number }>;
  email?: string;
  guestMode?: boolean;
  providerId?: string;
  loyaltyPointsToRedeem?: number;
  shippingOptionId?: string;
  attribution?: CommerceAttribution;
};

const PROVIDER_IDS = new Set<string>(Object.values(PAYMENT_PROVIDER_IDS));

function workerBaseUrl(): string | null {
  const value = process.env.API_URL?.trim().replace(/\/$/, "");
  return value || null;
}

function workerProvider(
  providerId: string,
): "stripe" | "paypal" | "xendit" | null {
  if (providerId === PAYMENT_PROVIDER_IDS.STRIPE) return "stripe";
  if (providerId === PAYMENT_PROVIDER_IDS.PAYPAL) return "paypal";
  if (providerId === PAYMENT_PROVIDER_IDS.XENDIT) return "xendit";
  return null;
}

async function stableCheckoutKey(
  cartId: string,
  provider: string,
  body: StartBody,
): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify({ cartId, provider, body })),
  );
  const suffix = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  )
    .join("")
    .slice(0, 32);
  return `storefront-checkout-${suffix}`;
}

async function startWorkerCheckout(input: {
  request: Request;
  body: StartBody;
  cartId: string;
  email: string;
  provider: "stripe" | "paypal" | "xendit";
  providerId: string;
  baseUrl: string;
}): Promise<Response> {
  const configuredOrigin =
    process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "") ||
    new URL(input.request.url).origin;
  let origin: URL;
  try {
    origin = new URL(configuredOrigin);
  } catch {
    return NextResponse.json(
      { error: "Checkout origin is not configured." },
      { status: 503 },
    );
  }
  const localLoopbackOrigin =
    process.env.NODE_ENV !== "production" &&
    (origin.hostname === "localhost" || origin.hostname === "127.0.0.1");
  if (origin.protocol !== "https:" && !localLoopbackOrigin) {
    return NextResponse.json(
      { error: "Worker checkout requires an HTTPS storefront origin." },
      { status: 503 },
    );
  }

  const idempotencyKey = await stableCheckoutKey(
    input.cartId,
    input.provider,
    input.body,
  );
  const updateResponse = await fetch(
    `${input.baseUrl}/store/carts/${encodeURIComponent(input.cartId)}`,
    {
      method: "PUT",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "Idempotency-Key": `${idempotencyKey}-cart`,
      },
      body: JSON.stringify({ email: input.email }),
      cache: "no-store",
    },
  );
  if (!updateResponse.ok) {
    return NextResponse.json(
      { error: "The checkout cart could not be prepared." },
      { status: updateResponse.status === 404 ? 409 : 502 },
    );
  }

  const successUrl = new URL(
    `/checkout/hosted-return?provider=${input.provider}&status=success`,
    origin,
  );
  const cancelUrl = new URL(
    `/checkout/hosted-return?provider=${input.provider}&status=cancel`,
    origin,
  );
  if (input.provider === "stripe") {
    successUrl.searchParams.set("token", "{CHECKOUT_SESSION_ID}");
  }
  const response = await fetch(`${input.baseUrl}/store/checkout/session`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      cart_id: input.cartId,
      provider: input.provider,
      success_url: successUrl.toString(),
      cancel_url: cancelUrl.toString(),
    }),
    cache: "no-store",
  });
  const payload = await readResponseJson(response, {} as {
    checkout?: { id?: unknown; url?: unknown };
    amountMinor?: unknown;
    currency?: unknown;
    correlationId?: unknown;
    error?: unknown;
  });
  if (!response.ok) {
    return NextResponse.json(
      {
        error:
          typeof payload.error === "string"
            ? payload.error
            : "Payment provider could not start checkout.",
      },
      { status: response.status },
    );
  }
  const checkoutId =
    typeof payload.checkout?.id === "string" ? payload.checkout.id : "";
  const checkoutUrl =
    typeof payload.checkout?.url === "string" ? payload.checkout.url : "";
  const correlationId =
    typeof payload.correlationId === "string" ? payload.correlationId : "";
  const amountMinor =
    typeof payload.amountMinor === "number" ? payload.amountMinor : 0;
  const currencyCode =
    typeof payload.currency === "string"
      ? payload.currency.toUpperCase()
      : "PHP";
  if (
    !checkoutId ||
    !checkoutUrl ||
    !correlationId ||
    !Number.isSafeInteger(amountMinor)
  ) {
    return NextResponse.json(
      { error: "Payment provider returned an invalid checkout." },
      { status: 502 },
    );
  }
  const providerLabel =
    input.provider === "stripe"
      ? "Debit or credit card"
      : input.provider === "paypal"
        ? "PayPal balance or card"
        : "GCash and bank transfer";
  return jsonResponse(
    checkoutStartResponseSchema.parse({
      checkoutUrl,
      cartId: input.cartId,
      providerLabel,
      confirmedTotal: amountMinor / minorUnitDivisor(currencyCode),
      currencyCode,
      paymentSessionId: checkoutId,
      providerPaymentId: checkoutId,
      quoteFingerprint: `worker:${correlationId}`,
      variantIds: [],
      productIds: [],
      checkoutActionKind: "redirect",
      correlationId,
      workerCheckout: true,
    }),
    201,
    input.cartId,
    correlationId,
  );
}

function jsonResponse(
  body: unknown,
  status = 200,
  cartId?: string,
  correlationId?: string,
): Response {
  const payload = JSON.stringify(body);
  const headers = new Headers({
    "Cache-Control": "no-store",
    Connection: "close",
    "Content-Length": String(Buffer.byteLength(payload)),
    "Content-Type": "application/json; charset=utf-8",
  });
  if (cartId) {
    headers.append(
      "Set-Cookie",
      `mcart_id=${encodeURIComponent(cartId)}; Path=/; Max-Age=604800; HttpOnly; SameSite=Lax`,
    );
  }
  if (correlationId)
    headers.append("Set-Cookie", checkoutAttemptCookieHeader(correlationId));
  return new Response(payload, {
    status,
    headers,
  });
}

function normalizeLines(lines: StartBody["lines"]): CheckoutLine[] {
  return (Array.isArray(lines) ? lines : []).flatMap((line) => {
    const variantId = typeof line?.variantId === "string" ? line.variantId.trim() : "";
    const quantity = typeof line?.quantity === "number" && Number.isFinite(line.quantity)
      ? Math.floor(line.quantity)
      : 0;
    return variantId.length > 0 && quantity > 0 && quantity <= 999
      ? [{ variantId, quantity }]
      : [];
  })
    .slice(0, 50);
}

export async function POST(req: Request) {
  if (!isSameOriginMutation(req)) {
    return NextResponse.json(
      { error: "Cross-site mutation rejected" },
      { status: 403 },
    );
  }
  const rl = await applyRateLimit(req, "checkout-start", 20, 60_000);
  if (!rl.ok) return rl.response;

  const parsed = await parseJsonBody<StartBody>(req);
  if (!parsed.ok) return parsed.response;

  const lines = normalizeLines(parsed.data.lines);
  if (lines.length === 0) {
    return NextResponse.json(
      { error: "Add at least one valid line item." },
      { status: 400 },
    );
  }

  const providerId =
    typeof parsed.data.providerId === "string"
      ? parsed.data.providerId.trim()
      : "";
  if (!PROVIDER_IDS.has(providerId)) {
    return NextResponse.json(
      { error: "A valid payment provider is required." },
      { status: 400 },
    );
  }

  if (providerId === PAYMENT_PROVIDER_IDS.COD) {
    const baseUrl = workerBaseUrl();
    if (!baseUrl) {
      return NextResponse.json(
        { error: "Worker API is not configured for checkout." },
        { status: 503 },
      );
    }

    // COD still needs a Worker-owned cart before the payment-intent route can
    // register or finalize it. Hosted providers create that cart in this
    // route as part of session startup; keep the native COD path on the same
    // cookie-backed contract instead of relying on client-only cart state.
    let cartId = await readCartIdFromCookie();
    if (!cartId) {
      try {
        cartId = await createWorkerCheckoutCart(baseUrl, lines);
      } catch (error) {
        console.error("[checkout-start] Worker COD cart creation failed", {
          name: error instanceof Error ? error.name : "unknown",
        });
        return NextResponse.json(
          { error: "The checkout cart could not be prepared." },
          { status: 502 },
        );
      }
    }

    return jsonResponse(
      {
        cartId,
        providerLabel: "Cash on delivery (COD)",
        checkoutActionKind: "manual",
        workerCheckout: true,
      },
      200,
      cartId,
    );
  }

  const nativeProvider = workerProvider(providerId);
  const nativeBaseUrl = workerBaseUrl();
  let sessionEmail = "";
  if (nativeProvider && nativeBaseUrl) {
    const supabase = await createSupabaseServerClient().catch(() => null);
    const { data } = supabase
      ? await supabase.auth.getUser()
      : { data: { user: null } };
    sessionEmail = data.user?.email?.trim().toLowerCase() ?? "";
  } else {
    return NextResponse.json(
      { error: "Worker API is not configured for checkout." },
      { status: 503 },
    );
  }

  // An explicit guest checkout is intentionally allowed to use the receipt
  // email entered in the checkout form, even when a stale authenticated
  // session cookie is present in the browser. Signed-in checkout keeps the
  // account-email ownership guard.
  const emailResult = resolveCheckoutEmail(
    parsed.data.guestMode === true ? "" : sessionEmail,
    parsed.data.email,
  );
  if (!emailResult.ok && emailResult.error === "account_email_mismatch") {
    return NextResponse.json(
      { error: "Signed-in checkout must use the email on your account." },
      { status: 409 },
    );
  }
  const email = emailResult.ok ? emailResult.email : "";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { error: "Enter a valid checkout email." },
      { status: 400 },
    );
  }

  if (nativeProvider && nativeBaseUrl) {
    let cartId = await readCartIdFromCookie();
    if (!cartId) {
      try {
        cartId = await createWorkerCheckoutCart(nativeBaseUrl, lines);
      } catch (error) {
        console.error("[checkout-start] Worker cart creation failed", {
          name: error instanceof Error ? error.name : "unknown",
        });
        return NextResponse.json(
          { error: "The checkout cart could not be prepared." },
          { status: 502 },
        );
      }
    }
    try {
      return await startWorkerCheckout({
        request: req,
        body: parsed.data,
        cartId,
        email,
        provider: nativeProvider,
        providerId,
        baseUrl: nativeBaseUrl,
      });
    } catch (error) {
      console.error("[checkout-start] Worker checkout initialization failed", {
        providerId,
        name: error instanceof Error ? error.name : "unknown",
      });
      return NextResponse.json(
        { error: "Payment checkout is temporarily unavailable." },
        { status: 502 },
      );
    }
  }

  return NextResponse.json(
    { error: "Worker checkout is unavailable." },
    { status: 503 },
  );
}
