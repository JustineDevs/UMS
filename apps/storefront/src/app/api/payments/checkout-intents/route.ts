import { NextResponse } from "next/server";
import { registerPaymentAttempt } from "@universal-music-store/platform-data";

import { getStorefrontSession } from "@/lib/auth";
import { applyRateLimit, readCartIdFromCookie } from "@/lib/cart-api-helpers";
import { loadCustomerProfile } from "@/lib/server-customer-profile";
import { isStorefrontProfileComplete } from "@/lib/storefront-profile-complete";
import { readVerifiedMedusaCartTotalsPreview } from "@/lib/medusa-checkout-cart-prep";
import { minorUnitDivisor } from "@/lib/medusa-money";
import {
  reconcileCheckoutIntentQuote,
  registerCheckoutIntentRouteLogic,
} from "@/lib/payment-attempt-route-logic";
import { createStorefrontServiceSupabase } from "@/lib/storefront-supabase";
import { logCommerceObservabilityServer } from "@/lib/commerce-observability";
import { capturePostHogEvent } from "@universal-music-store/sdk";

export const dynamic = "force-dynamic";

type Body = {
  provider?: string;
  amountMinor?: number;
  currencyCode?: string;
  quoteFingerprint?: string;
  variantIds?: string[];
  productIds?: string[];
  medusaPaymentSessionId?: string;
  providerSessionId?: string;
  idempotencyKey?: string;
};

/**
 * Registers a durable payment/checkout attempt (ledger row) before redirecting to a hosted PSP.
 */
export async function POST(req: Request) {
  const session = await getStorefrontSession();
  const sessionEmail = session?.user?.email?.trim().toLowerCase();
  if (!sessionEmail) {
    return NextResponse.json({ error: "Sign in before checkout" }, { status: 401 });
  }

  const rl = await applyRateLimit(req, "checkout-intents", 60, 60_000);
  if (!rl.ok) {
    return rl.response;
  }

  const cartId = await readCartIdFromCookie();
  if (!cartId) {
    return NextResponse.json({ error: "No active cart" }, { status: 400 });
  }

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    body = {};
  }

  const provider = typeof body.provider === "string" ? body.provider.trim().toLowerCase() : "";
  if (!provider || !["cod", "stripe", "paypal", "xendit"].includes(provider)) {
    return NextResponse.json({ error: "provider is required" }, { status: 400 });
  }

  const profile = await loadCustomerProfile(sessionEmail);
  if (!isStorefrontProfileComplete(profile)) {
    return NextResponse.json(
      { error: "Complete your delivery profile before checkout" },
      { status: 400 },
    );
  }

  const amountMinor =
    typeof body.amountMinor === "number" && Number.isFinite(body.amountMinor)
      ? Math.max(0, Math.floor(body.amountMinor))
      : 0;
  const currencyCode =
    typeof body.currencyCode === "string" && body.currencyCode.trim()
      ? body.currencyCode.trim()
      : "PHP";
  let authoritative;
  try {
    authoritative = await readVerifiedMedusaCartTotalsPreview(cartId);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not reconcile checkout cart",
      },
      { status: 409 },
    );
  }

  const submittedQuoteFingerprint =
    typeof body.quoteFingerprint === "string" ? body.quoteFingerprint.trim() : "";
  const quoteMismatch = reconcileCheckoutIntentQuote({
    submittedQuoteFingerprint,
    authoritativeQuoteFingerprint: authoritative.quoteFingerprint,
  });
  if (quoteMismatch) {
    return NextResponse.json(quoteMismatch.body, { status: quoteMismatch.status });
  }
  const authoritativeAmountMinor = Math.max(
    0,
    Math.round(authoritative.total * minorUnitDivisor(authoritative.currencyCode)),
  );

  const sb = createStorefrontServiceSupabase();
  const result = await registerCheckoutIntentRouteLogic({
    organizationId: process.env.DEFAULT_ORGANIZATION_ID?.trim() || undefined,
    cartId,
    provider,
    amountMinor: authoritativeAmountMinor || amountMinor,
    currencyCode: authoritative.currencyCode || currencyCode,
    quoteFingerprint: authoritative.quoteFingerprint,
    variantIds: authoritative.variantIds,
    productIds: authoritative.productIds,
    medusaPaymentSessionId: body.medusaPaymentSessionId,
    providerSessionId: body.providerSessionId,
    idempotencyKey: body.idempotencyKey,
    supabaseAvailable: Boolean(sb),
    registerPaymentAttempt: async (input) => {
      if (!sb) {
        throw new Error("Payment ledger is not configured");
      }
      return registerPaymentAttempt(sb, input);
    },
  });

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
        error: typeof result.body === "object" && result.body && "error" in result.body
          ? String((result.body as { error?: unknown }).error ?? "")
          : null,
      },
    });
  }

  return NextResponse.json(result.body, { status: result.status });
}
