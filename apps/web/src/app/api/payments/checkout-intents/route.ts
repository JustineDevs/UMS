import { NextResponse } from "next/server";

import { getStorefrontSession } from "@/lib/auth";
import { applyRateLimit, readCartIdFromCookie, writeCartCookie } from "@/lib/cart-api-helpers";
import { createWorkerCheckoutCart } from "@/lib/worker-checkout-cart";
import { loadCustomerProfile } from "@/lib/server-customer-profile";
import { isStorefrontProfileComplete } from "@/lib/storefront-profile-complete";
import { readVerifiedCheckoutCartTotalsPreview } from "@/lib/checkout-worker";
import {
  reconcileCheckoutIntentQuote,
  registerCheckoutIntentRouteLogic,
} from "@/lib/payment-attempt-route-logic";
import { logCommerceObservabilityServer } from "@/lib/commerce-observability";
import { capturePostHogEvent } from "@universal-music-store/sdk";
import { isSameOriginMutation } from "@/lib/request-origin";
import { parseBoundedJson } from "@/lib/bounded-request-body";
import { paymentCheckoutIntentSchema } from "@/lib/admin-api-contracts";
import {
  isIsolatedCodE2E,
  registerIsolatedCodAttempt,
} from "@/lib/isolated-cod-e2e-ledger";
import { checkoutIntentRegistrationResponseSchema } from "@/lib/admin-api-contracts";
import { readResponseJson } from "@/lib/read-response-json";

export const dynamic = "force-dynamic";

/**
 * Registers a durable payment/checkout attempt (ledger row) before redirecting to a hosted PSP.
 */
export async function POST(req: Request) {
  if (!isSameOriginMutation(req)) {
    return NextResponse.json(
      { error: "Cross-site mutation rejected" },
      { status: 403 },
    );
  }
  const session = await getStorefrontSession();
  const sessionEmail = session?.user?.email?.trim().toLowerCase();
  if (!sessionEmail) {
    return NextResponse.json(
      { error: "Sign in before checkout" },
      { status: 401 },
    );
  }

  const rl = await applyRateLimit(req, "checkout-intents", 60, 60_000);
  if (!rl.ok) {
    return rl.response;
  }

  const bounded = await parseBoundedJson(req, 16 * 1024);
  if (bounded.tooLarge) {
    return NextResponse.json(
      { error: "Request body is too large" },
      { status: 413 },
    );
  }
  const parsed = paymentCheckoutIntentSchema.safeParse(
    bounded.valid ? bounded.value : undefined,
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "provider is required" },
      { status: 400 },
    );
  }
  const body = parsed.data;
  const provider = body.provider;

  let cartId = await readCartIdFromCookie();
  if (!cartId && body.lines?.length) {
    const apiUrl = process.env.API_URL?.trim().replace(/\/$/, "");
    if (!apiUrl) {
      return NextResponse.json(
        { error: "Checkout service is temporarily unavailable" },
        { status: 503 },
      );
    }
    try {
      const retryKey = req.headers.get("Idempotency-Key")?.trim();
      const createdCartId = await createWorkerCheckoutCart(apiUrl, body.lines, retryKey);
      cartId = createdCartId;
      await writeCartCookie(createdCartId);
    } catch {
      return NextResponse.json(
        { error: "The checkout cart could not be prepared." },
        { status: 502 },
      );
    }
  }
  if (!cartId) {
    return NextResponse.json({ error: "No active cart" }, { status: 400 });
  }

  const profile = await loadCustomerProfile(sessionEmail);
  if (!isStorefrontProfileComplete(profile)) {
    return NextResponse.json(
      { error: "Complete your delivery profile before checkout" },
      { status: 400 },
    );
  }

  let authoritative;
  try {
    authoritative = await readVerifiedCheckoutCartTotalsPreview(cartId);
  } catch (error) {
    const correlationId = crypto.randomUUID();
    console.error("[checkout-intents] cart reconciliation failed", {
      correlationId,
      error: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      {
        error: "Could not reconcile checkout cart",
        code: "CHECKOUT_CART_RECONCILIATION_FAILED",
        requestId: correlationId,
      },
      { status: 409 },
    );
  }

  const submittedQuoteFingerprint =
    typeof body.quoteFingerprint === "string"
      ? body.quoteFingerprint.trim()
      : "";
  const quoteMismatch = reconcileCheckoutIntentQuote({
    submittedQuoteFingerprint,
    authoritativeQuoteFingerprint: authoritative.quoteFingerprint,
  });
  if (quoteMismatch) {
    return NextResponse.json(quoteMismatch.body, {
      status: quoteMismatch.status,
    });
  }
  const isolatedCodE2E = isIsolatedCodE2E() && provider === "cod";
  let result: { status: number; body: unknown };
  let workerSetCookie: string | null = null;
  if (isolatedCodE2E) {
    result = await registerCheckoutIntentRouteLogic({
      cartId,
      provider,
      amountMinor: 0,
      currencyCode: authoritative.currencyCode,
      quoteFingerprint: authoritative.quoteFingerprint,
      variantIds: authoritative.variantIds,
      productIds: authoritative.productIds,
      supabaseAvailable: true,
      registerPaymentAttempt: async (input) =>
        registerIsolatedCodAttempt({
          cartId: input.cartId,
          quoteFingerprint: input.quoteFingerprint ?? "",
        }),
    });
  } else {
    const apiUrl = process.env.API_URL?.trim().replace(/\/$/, "");
    if (!apiUrl) {
      return NextResponse.json(
        { error: "Checkout service is temporarily unavailable" },
        { status: 503 },
      );
    }
    try {
      const workerResponse = await fetch(`${apiUrl}/store/checkout-intents`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Cookie: `mcart_id=${encodeURIComponent(cartId)}`,
        },
        body: JSON.stringify({
          cartId,
          provider,
          quoteFingerprint: authoritative.quoteFingerprint,
          medusaPaymentSessionId: body.medusaPaymentSessionId,
          providerSessionId: body.providerSessionId,
          providerPaymentId: body.providerPaymentId,
          idempotencyKey: body.idempotencyKey,
        }),
        cache: "no-store",
      });
      result = {
        status: workerResponse.status,
        body: await readResponseJson<unknown>(workerResponse, {
          error: "Checkout service returned an invalid response",
        }),
      };
      workerSetCookie = workerResponse.headers.get("set-cookie");
    } catch {
      return NextResponse.json(
        { error: "Checkout service is temporarily unavailable" },
        { status: 503 },
      );
    }
  }

  if (result.status === 200 && result.body && typeof result.body === "object") {
    const b = result.body as { correlationId?: string; reused?: boolean };
    logCommerceObservabilityServer("payment_session_created", {
      correlationId: b.correlationId,
      cartId,
      provider,
      reused: b.reused === true,
      quoteFingerprint: authoritative.quoteFingerprint,
    });
    void capturePostHogEvent({
      event: "checkout_intent_registered",
      distinctId: cartId,
      properties: {
        correlationId: b.correlationId ?? null,
        cartId,
        provider,
        reused: b.reused === true,
        quoteFingerprint: authoritative.quoteFingerprint,
      },
    });
  }

  if (result.status >= 400) {
    void capturePostHogEvent({
      event: "checkout_intent_registration_failed",
      distinctId: cartId,
      properties: {
        cartId,
        provider,
        status: result.status,
        error:
          typeof result.body === "object" &&
          result.body &&
          "error" in result.body
            ? String((result.body as { error?: unknown }).error ?? "")
            : null,
      },
    });
  }

  if (result.status === 200) {
    const parsedResponse = checkoutIntentRegistrationResponseSchema.safeParse(
      result.body,
    );
    if (!parsedResponse.success)
      return NextResponse.json(
        { error: "Checkout intent returned an invalid response" },
        { status: 502 },
      );
    const response = NextResponse.json(parsedResponse.data, {
      status: result.status,
    });
    if (workerSetCookie) response.headers.set("Set-Cookie", workerSetCookie);
    return response;
  }
  return NextResponse.json(result.body, { status: result.status });
}
