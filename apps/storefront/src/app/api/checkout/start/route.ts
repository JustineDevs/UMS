import { NextResponse } from "next/server";
import { registerPaymentAttempt } from "@universal-music-store/platform-data";
import { buildTrackingUrl, DEFAULT_PUBLIC_SITE_ORIGIN } from "@universal-music-store/sdk";

import { getStorefrontSession } from "@/lib/auth";
import { applyRateLimit, parseJsonBody } from "@/lib/cart-api-helpers";
import {
  PAYMENT_PROVIDER_IDS,
  startMedusaCheckout,
  type MedusaCheckoutLine,
} from "@/lib/medusa-checkout";
import { formatMedusaCheckoutError } from "@/lib/medusa-checkout-errors";
import { createStorefrontServiceSupabase } from "@/lib/storefront-supabase";
import { minorUnitDivisor } from "@/lib/medusa-money";
import { registerCheckoutIntentRouteLogic } from "@/lib/payment-attempt-route-logic";

export const dynamic = "force-dynamic";

type StartBody = {
  lines?: Array<{ variantId?: string; quantity?: number }>;
  email?: string;
  providerId?: string;
  loyaltyPointsToRedeem?: number;
  shippingOptionId?: string;
};

const PROVIDER_IDS = new Set<string>(Object.values(PAYMENT_PROVIDER_IDS));

function jsonResponse(body: unknown, status = 200, cartId?: string): Response {
  const payload = JSON.stringify(body);
  return new Response(payload, {
    status,
    headers: {
      "Cache-Control": "no-store",
      Connection: "close",
      "Content-Length": String(Buffer.byteLength(payload)),
      "Content-Type": "application/json; charset=utf-8",
      ...(cartId
        ? {
            "Set-Cookie": `mcart_id=${encodeURIComponent(cartId)}; Path=/; Max-Age=604800; HttpOnly; SameSite=Lax`,
          }
        : {}),
    },
  });
}

function normalizeLines(lines: StartBody["lines"]): MedusaCheckoutLine[] {
  return (Array.isArray(lines) ? lines : [])
    .map((line) => ({
      variantId: typeof line?.variantId === "string" ? line.variantId.trim() : "",
      quantity:
        typeof line?.quantity === "number" && Number.isFinite(line.quantity)
          ? Math.floor(line.quantity)
          : 0,
    }))
    .filter((line) => line.variantId.length > 0 && line.quantity > 0 && line.quantity <= 99)
    .slice(0, 50);
}

export async function POST(req: Request) {
  const session = await getStorefrontSession();
  const sessionEmail = session?.user?.email?.trim().toLowerCase() ?? "";

  const rl = await applyRateLimit(req, "checkout-start", 20, 60_000);
  if (!rl.ok) return rl.response;

  const parsed = await parseJsonBody<StartBody>(req);
  if (!parsed.ok) return parsed.response;

  const lines = normalizeLines(parsed.data.lines);
  if (lines.length === 0) {
    return NextResponse.json({ error: "Add at least one valid line item." }, { status: 400 });
  }

  const providerId = typeof parsed.data.providerId === "string" ? parsed.data.providerId.trim() : "";
  if (!PROVIDER_IDS.has(providerId)) {
    return NextResponse.json({ error: "A valid payment provider is required." }, { status: 400 });
  }

  if (providerId === PAYMENT_PROVIDER_IDS.COD) {
    return NextResponse.json(
      { error: "Cash on delivery must be started from the browser checkout flow." },
      { status: 400 },
    );
  }

  const email =
    typeof parsed.data.email === "string" && parsed.data.email.trim()
      ? parsed.data.email.trim().toLowerCase()
      : sessionEmail;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid checkout email." }, { status: 400 });
  }

  try {
    const result = await startMedusaCheckout({
      lines,
      email,
      providerId,
      loyaltyPointsToRedeem:
        typeof parsed.data.loyaltyPointsToRedeem === "number" &&
        Number.isFinite(parsed.data.loyaltyPointsToRedeem) &&
        parsed.data.loyaltyPointsToRedeem > 0
          ? Math.floor(parsed.data.loyaltyPointsToRedeem)
          : undefined,
      shippingOptionId:
        typeof parsed.data.shippingOptionId === "string" && parsed.data.shippingOptionId.trim()
          ? parsed.data.shippingOptionId.trim()
          : undefined,
    });
    const trackingBase =
      process.env.NEXT_PUBLIC_SITE_URL?.trim() || DEFAULT_PUBLIC_SITE_ORIGIN;
    const sb = createStorefrontServiceSupabase();
    if (!sb) {
      return NextResponse.json({ error: "Payment ledger is not configured." }, { status: 503 });
    }
    const registered = await registerCheckoutIntentRouteLogic({
      organizationId: process.env.DEFAULT_ORGANIZATION_ID?.trim() || undefined,
      cartId: result.cartId,
      provider: providerId.replace(/^pp_[^_]+_/, ""),
      amountMinor: Math.max(
        0,
        Math.round(result.confirmedTotal * minorUnitDivisor(result.currencyCode)),
      ),
      currencyCode: result.currencyCode,
      quoteFingerprint: result.quoteFingerprint,
      variantIds: result.variantIds,
      productIds: result.productIds,
      providerSessionId: result.paymentSessionId,
      supabaseAvailable: true,
      registerPaymentAttempt: (input) => registerPaymentAttempt(sb, input),
    });
    if (registered.status >= 400 || !registered.body || typeof registered.body !== "object") {
      return NextResponse.json(registered.body, { status: registered.status });
    }
    const correlationId = (registered.body as { correlationId?: unknown }).correlationId;
    if (typeof correlationId !== "string" || !correlationId) {
      return NextResponse.json({ error: "Could not register payment attempt." }, { status: 502 });
    }
    return jsonResponse({
      ...result,
      correlationId,
      trackingPageUrl: buildTrackingUrl(trackingBase, result.cartId),
    }, 200, result.cartId);
  } catch (error) {
    const safeError = formatMedusaCheckoutError(error);
    console.error("[checkout-start] provider initialization failed", {
      providerId,
      name: error instanceof Error ? error.name : "unknown",
      message: safeError,
    });
    return NextResponse.json(
      { error: safeError },
      { status: 502 },
    );
  }
}
