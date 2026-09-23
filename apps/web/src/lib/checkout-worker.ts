import type { CommerceAttribution } from "@universal-music-store/sdk";
import { minorUnitDivisor } from "@universal-music-store/sdk/multi-region";
import { readResponseJson } from "./read-response-json";

export type CheckoutLine = { variantId: string; quantity: number };

export type CodCartPayload = {
  email: string;
  shipping_address: Record<string, unknown>;
  billing_address: Record<string, unknown>;
};

type ShippingOptionPreview = {
  id: string;
  name: string;
  priceMajor: number;
  currencyCode: string;
};

export type CheckoutTotalsPreview = {
  cartId?: string;
  subtotal: number;
  taxTotal: number;
  shippingTotal: number;
  discountTotal: number;
  total: number;
  currencyCode: string;
  lineSubtotalsByVariantId: Record<string, number>;
  quoteFingerprint: string;
  variantIds: string[];
  productIds: string[];
  shippingMethodIds: string[];
  regionId: string | null;
  shippingOptions: ShippingOptionPreview[];
  appliedShippingOptionId: string | null;
};

export const PAYMENT_PROVIDER_IDS = {
  STRIPE: "pp_stripe_stripe",
  PAYPAL: "pp_paypal_paypal",
  XENDIT: "pp_xendit_xendit",
  COD: "pp_cod_cod",
} as const;

export type PaymentProviderKey = keyof typeof PAYMENT_PROVIDER_IDS;

export const PAYMENT_PROVIDER_LABELS: Record<PaymentProviderKey, string> = {
  STRIPE: "Debit or credit card",
  PAYPAL: "PayPal balance or card",
  XENDIT: "GCash and bank transfer",
  COD: "Cash on delivery (COD)",
};

export type CheckoutResult = {
  checkoutUrl: string;
  cartId: string;
  providerLabel: string;
  confirmedTotal: number;
  currencyCode: string;
  confirmedPreview?: CheckoutTotalsPreview;
  stripeClientSecret?: string;
  paypalOrderId?: string;
  xenditComponentsSdkKey?: string;
  paymentSessionId?: string;
  providerPaymentId?: string;
  codOrderPlaced?: boolean;
  orderId?: string;
  quoteFingerprint: string;
  variantIds: string[];
  productIds: string[];
  checkoutActionKind?: "redirect" | "wallet" | "qr" | "embedded" | "manual";
  walletUrl?: string;
  qrImageUrl?: string;
  qrPayload?: string;
  trackingPageUrl?: string;
  correlationId?: string;
};

export function resolveShippingOptionId(
  options: Array<{ id?: string }>,
  requested?: string,
): string | null {
  const normalized = requested?.trim();
  if (normalized && options.some((option) => option.id === normalized))
    return normalized;
  return options.length === 1 ? options[0]?.id?.trim() || null : null;
}

async function readJson<T>(response: Response): Promise<T> {
  return readResponseJson(response, {} as T);
}

async function readWorkerCart(
  cartId: string,
): Promise<Record<string, unknown>> {
  const base = process.env.API_URL?.trim().replace(/\/$/, "");
  if (!base) throw new Error("Worker API is not configured.");
  const response = await fetch(
    `${base}/store/carts/${encodeURIComponent(cartId)}`,
    { cache: "no-store" },
  );
  const payload = await readJson<{ cart?: unknown; error?: string }>(response);
  if (
    !response.ok ||
    !payload.cart ||
    typeof payload.cart !== "object" ||
    Array.isArray(payload.cart)
  ) {
    throw new Error(payload.error?.trim() || "Checkout cart is unavailable.");
  }
  return payload.cart as Record<string, unknown>;
}

async function readWorkerCartPreview(
  cartId: string,
): Promise<CheckoutTotalsPreview> {
  const cart = await readWorkerCart(cartId);
  const lines = (Array.isArray(cart.items) ? cart.items : []).flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const row = item as Record<string, unknown>;
    const variantId = typeof row.variant_id === "string" ? row.variant_id.trim() : "";
    const quantity = typeof row.quantity === "number" && Number.isSafeInteger(row.quantity)
      ? row.quantity
      : 0;
    return variantId && quantity > 0 ? [{ variantId, quantity }] : [];
  });
  if (lines.length === 0)
    throw new Error("Add at least one line item before checkout.");
  const base = process.env.API_URL?.trim().replace(/\/$/, "");
  if (!base) throw new Error("Worker API is not configured.");
  const response = await fetch(`${base}/store/checkout/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ lines }),
    cache: "no-store",
  });
  const payload = await readJson<CheckoutTotalsPreview & { error?: string }>(
    response,
  );
  if (!response.ok)
    throw new Error(payload.error?.trim() || "Checkout quote is unavailable.");
  return { ...payload, cartId };
}

export function readCheckoutCartTotalsPreview(
  cartId: string,
): Promise<CheckoutTotalsPreview> {
  return readWorkerCartPreview(cartId);
}

export function readVerifiedCheckoutCartTotalsPreview(
  cartId: string,
): Promise<CheckoutTotalsPreview> {
  return readWorkerCartPreview(cartId);
}

export async function previewCheckoutTotals(input: {
  lines: CheckoutLine[];
  email?: string;
  loyaltyPointsToRedeem?: number;
  paymentMethod: PaymentProviderKey;
  shippingOptionId?: string;
  attribution?: CommerceAttribution;
  signal?: AbortSignal;
}): Promise<CheckoutTotalsPreview> {
  if (typeof window === "undefined")
    throw new Error("Checkout preview must run in the browser.");
  const response = await fetch("/api/checkout/preview", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal: input.signal,
  });
  const payload = await readJson<
    Partial<CheckoutTotalsPreview> & { error?: string }
  >(response);
  if (!response.ok)
    throw new Error(
      payload.error?.trim() ||
        `Could not load checkout totals (${response.status}).`,
    );
  if (
    typeof payload.total !== "number" ||
    typeof payload.currencyCode !== "string"
  )
    throw new Error("Invalid totals response from Worker.");
  return payload as CheckoutTotalsPreview;
}

function providerKeyFromId(providerId: string): PaymentProviderKey | null {
  const entry = (
    Object.entries(PAYMENT_PROVIDER_IDS) as Array<[PaymentProviderKey, string]>
  ).find(([, value]) => value === providerId);
  return entry?.[0] ?? null;
}

export async function startCheckout(input: {
  lines: CheckoutLine[];
  email?: string;
  providerId?: string;
  loyaltyPointsToRedeem?: number;
  codCartPayload?: CodCartPayload;
  shippingOptionId?: string;
  attribution?: CommerceAttribution;
  checkoutAttemptKey?: string;
}): Promise<CheckoutResult> {
  if (typeof window === "undefined")
    throw new Error("Checkout must run in the browser.");
  const providerId = input.providerId?.trim() || PAYMENT_PROVIDER_IDS.COD;
  const provider = providerKeyFromId(providerId);
  if (!provider) throw new Error("A valid payment provider is required.");

  const preview = await previewCheckoutTotals({
    lines: input.lines,
    email: provider === "COD" ? undefined : input.email?.trim(),
    loyaltyPointsToRedeem: input.loyaltyPointsToRedeem,
    paymentMethod: provider,
    shippingOptionId: input.shippingOptionId,
    attribution: input.attribution,
  });
  const amountMinor = Math.max(
    0,
    Math.round(preview.total * minorUnitDivisor(preview.currencyCode)),
  );

  if (provider === "COD") {
    // The cart UI may still have a valid local line snapshot while the
    // HttpOnly Worker cart cookie is absent (for example after a fresh
    // browser session). Prepare the authoritative Worker cart before the
    // intent and finalization calls, otherwise COD fails with "No active
    // cart" even though checkout visibly contains items.
    const cartPreparation = await fetch("/api/checkout/start", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(input.checkoutAttemptKey
          ? { "Idempotency-Key": input.checkoutAttemptKey }
          : {}),
      },
      body: JSON.stringify({
        lines: input.lines,
        email: input.email,
        providerId: PAYMENT_PROVIDER_IDS.COD,
      }),
    });
    const cartPreparationBody = await readJson<{
      cartId?: string;
      error?: string;
    }>(
      cartPreparation,
    );
    if (!cartPreparation.ok) {
      throw new Error(
        cartPreparationBody.error?.trim() ||
          "Could not prepare the COD checkout cart.",
      );
    }

    const intent = await fetch("/api/payments/checkout-intents", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "cod",
        lines: input.lines,
        amountMinor,
        currencyCode: preview.currencyCode,
        quoteFingerprint: preview.quoteFingerprint,
        variantIds: preview.variantIds,
        productIds: preview.productIds,
      }),
    });
    const intentBody = await readJson<{
      correlationId?: string;
      cartId?: string;
      error?: string;
    }>(intent);
    if (!intent.ok || !intentBody.correlationId)
      throw new Error(
        intentBody.error?.trim() || "Could not register COD checkout.",
      );
    const placement = await fetch("/api/checkout/cod-place-order", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        correlationId: intentBody.correlationId,
        cartId: intentBody.cartId ?? cartPreparationBody.cartId,
      }),
    });
    const placementBody = await readJson<{
      orderId?: string;
      redirectUrl?: string;
      error?: string;
    }>(placement);
    if (!placement.ok || !placementBody.orderId)
      throw new Error(
        placementBody.error?.trim() || "Could not place your COD order.",
      );
    return {
      checkoutUrl: "",
      cartId: preview.cartId ?? "",
      providerLabel: PAYMENT_PROVIDER_LABELS[provider],
      confirmedTotal: preview.total,
      currencyCode: preview.currencyCode,
      confirmedPreview: preview,
      codOrderPlaced: true,
      orderId: placementBody.orderId,
      trackingPageUrl: placementBody.redirectUrl,
      correlationId: intentBody.correlationId,
      quoteFingerprint: preview.quoteFingerprint,
      variantIds: preview.variantIds,
      productIds: preview.productIds,
      checkoutActionKind: "manual",
    };
  }

  const response = await fetch("/api/checkout/start", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(input.checkoutAttemptKey
        ? { "Idempotency-Key": input.checkoutAttemptKey }
        : {}),
    },
    body: JSON.stringify({
      lines: input.lines,
      email: input.email,
      providerId,
      loyaltyPointsToRedeem: input.loyaltyPointsToRedeem,
      shippingOptionId: input.shippingOptionId,
      attribution: input.attribution,
    }),
  });
  const payload = await readJson<CheckoutResult & { error?: string }>(response);
  if (!response.ok)
    throw new Error(payload.error?.trim() || "Could not start checkout.");
  if (typeof payload.cartId !== "string")
    throw new Error("Worker returned an invalid checkout.");
  return { ...payload, confirmedPreview: payload.confirmedPreview ?? preview };
}
