/**
 * Browser checkout orchestration (three conceptual phases):
 * 1) `prepareMedusaStoreCart` in medusa-checkout-cart-prep (cart + shipping + loyalty).
 * 2) Medusa `initiatePaymentSession` (provider session / embedded data).
 * 3) Ledger + server completion: POST /api/payments/checkout-intents, then finalize
 *    (hosted: …/finalize; COD: /api/checkout/cod-place-order). No order finalization here alone.
 */
import {
  formatMedusaCheckoutError,
  tryDeleteStoreCart,
} from "./medusa-checkout-errors";
import {
  getMedusaPaymentProviderId,
  getMedusaRegionId,
  getMedusaStoreBaseUrl,
  getMedusaPublishableKey,
} from "./storefront-medusa-env";
import {
  cartToTotalsPreview,
  prepareMedusaStoreCart,
  readMedusaCartMinorField,
  type MedusaCheckoutLine,
  type CodCartPayload,
  type MedusaCheckoutTotalsPreview,
} from "./medusa-checkout-cart-prep";
import { emitCommerceObservabilityClient } from "./commerce-observability";
import {
  pickPaymentSessionForProvider,
  resolveCheckoutAction,
  type CheckoutAction,
} from "./medusa-checkout-action";

export type { MedusaCheckoutLine, CodCartPayload, MedusaCheckoutTotalsPreview };

export type MedusaCheckoutResult = {
  checkoutUrl: string;
  cartId: string;
  providerLabel: string;
  /** Medusa cart total in major units (e.g. PHP) after shipping, loyalty, tax. */
  confirmedTotal: number;
  /** ISO currency code from the cart. */
  currencyCode: string;
  /** Full authoritative totals breakdown from the actual payment cart. */
  confirmedPreview?: MedusaCheckoutTotalsPreview;
  /** Stripe PaymentIntent client_secret when using Stripe Elements. */
  stripeClientSecret?: string;
  /** PayPal order ID when using PayPal JS SDK embedded buttons. */
  paypalOrderId?: string;
  /** Xendit Components SDK key when using embedded channel selection. */
  xenditComponentsSdkKey?: string;
  /** Provider payment-session ID used for durable reconciliation. */
  paymentSessionId?: string;
  /** Cash on delivery: cart was completed and an order was created. */
  codOrderPlaced?: boolean;
  /** Medusa order id when codOrderPlaced (e.g. order_...). */
  orderId?: string;
  /** Fresh authoritative quote fingerprint for the cart used to create this session. */
  quoteFingerprint: string;
  variantIds: string[];
  productIds: string[];
  /** Resolved Medusa payment session action after initiatePaymentSession. */
  checkoutActionKind?: CheckoutAction["kind"];
  /** Wallet-style hosted URL when action kind is wallet. */
  walletUrl?: string;
  /** QR image URL when action kind is qr and backend returns an image. */
  qrImageUrl?: string;
  /** Raw QR payload when action kind is qr. */
  qrPayload?: string;
};

/** Provider IDs from the store payment module (pp_{module}_{id}). */
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

function isCodProviderId(providerId: string): boolean {
  return providerId === PAYMENT_PROVIDER_IDS.COD || providerId.includes("cod_cod");
}

/**
 * Loads live totals from the server (same Medusa path as pay). Prefer over calling Medusa from the browser.
 */
export async function previewMedusaCheckoutTotals(input: {
  lines: MedusaCheckoutLine[];
  email?: string;
  loyaltyPointsToRedeem?: number;
  paymentMethod: PaymentProviderKey;
  shippingOptionId?: string;
}): Promise<MedusaCheckoutTotalsPreview> {
  if (typeof window === "undefined") {
    throw new Error("Checkout preview must run in the browser.");
  }
  const res = await fetch("/api/checkout/medusa-totals-preview", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      lines: input.lines,
      email: input.email,
      loyaltyPointsToRedeem: input.loyaltyPointsToRedeem,
      paymentMethod: input.paymentMethod,
      shippingOptionId: input.shippingOptionId,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as MedusaCheckoutTotalsPreview & {
    error?: string;
    missingFields?: string[];
  };
  if (!res.ok) {
    const hint =
      Array.isArray(data.missingFields) && data.missingFields.length
        ? ` ${data.missingFields.join(", ")}`
        : "";
    throw new Error(
      (typeof data.error === "string" && data.error.trim()
        ? data.error
        : `Could not load checkout totals (${res.status}).`) + hint,
    );
  }
  if (
    typeof data.total !== "number" ||
    typeof data.currencyCode !== "string"
  ) {
    throw new Error("Invalid totals response from server.");
  }
  return data as MedusaCheckoutTotalsPreview;
}

export async function startMedusaCheckout(input: {
  lines: MedusaCheckoutLine[];
  email?: string;
  providerId?: string;
  /** Deducts from Supabase-backed balance and applies a cart discount line (requires Medusa env). */
  loyaltyPointsToRedeem?: number;
  /** Required when provider is COD; from POST /api/checkout/cod-cart-payload. */
  codCartPayload?: CodCartPayload;
  shippingOptionId?: string;
}): Promise<MedusaCheckoutResult> {
  if (typeof window === "undefined") {
    throw new Error("Checkout must run in the browser.");
  }
  const baseUrl = getMedusaStoreBaseUrl();
  const publishableKey = getMedusaPublishableKey();
  const regionId = getMedusaRegionId();
  if (!publishableKey || !regionId) {
    throw new Error(
      "NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY and NEXT_PUBLIC_MEDUSA_REGION_ID are required.",
    );
  }

  const providerId =
    input.providerId?.trim() || getMedusaPaymentProviderId();
  const codFlow = isCodProviderId(providerId);
  if (codFlow) {
    if (!input.codCartPayload?.email?.trim()) {
      throw new Error(
        "Cash on delivery requires a verified delivery profile. Open your account and complete your address, then try again.",
      );
    }
  }

  let cartId: string | undefined;
  try {
    const ctx = await prepareMedusaStoreCart(
      {
        lines: input.lines,
        email: codFlow ? undefined : input.email?.trim(),
        codCartPayload: codFlow ? input.codCartPayload : undefined,
        loyaltyPointsToRedeem: input.loyaltyPointsToRedeem,
        shippingOptionId: input.shippingOptionId,
      },
      codFlow,
    );
    cartId = ctx.cartId;
    const { sdk } = ctx;

    const bindResponse = await fetch("/api/cart/medusa-bind", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cartId }),
    });
    if (!bindResponse.ok) {
      throw new Error("Could not bind the checkout cart. Please try again.");
    }

    const { cart: refreshedForPayment } = await sdk.store.cart.retrieve(cartId, {
      fields: "+payment_collection,*payment_collection.payment_sessions",
    } as never);

    const { payment_collection } = await sdk.store.payment.initiatePaymentSession(
      refreshedForPayment,
      {
        provider_id: providerId,
        data: {
          idempotency_key: cartId,
          ...(process.env.NANGO_PAYMENT_CONNECTION_ID
            ? { nango_connection_id: process.env.NANGO_PAYMENT_CONNECTION_ID }
            : {}),
          ...(process.env.NANGO_PAYMENT_PROVIDER_CONFIG_KEY
            ? { nango_provider_config_key: process.env.NANGO_PAYMENT_PROVIDER_CONFIG_KEY }
            : {}),
        },
      },
    );

    const sessions = payment_collection?.payment_sessions ?? [];
    const session = pickPaymentSessionForProvider(
      sessions as { id?: string; provider_id?: string; data?: Record<string, unknown> }[],
      providerId,
    );
    if (!session) {
      throw new Error(
        `No payment session for provider ${providerId}. Found sessions: ${sessions.map((s: { provider_id?: string }) => s.provider_id ?? "?").join(", ") || "(none)"}.`,
      );
    }

    const action = resolveCheckoutAction(providerId, session);
    if (action.kind === "error") {
      throw new Error(action.message);
    }

    let checkoutUrl = "";
    let stripeClientSecret: string | undefined;
    let paypalOid: string | undefined;
    let xenditComponentsSdkKey: string | undefined;
    let walletUrl: string | undefined;
    let qrImageUrl: string | undefined;
    let qrPayload: string | undefined;
    if (action.kind === "redirect") {
      checkoutUrl = action.url;
    } else if (action.kind === "wallet") {
      walletUrl = action.url;
      checkoutUrl = action.url;
    } else if (action.kind === "qr") {
      qrImageUrl = action.imageUrl;
      qrPayload = action.payload;
      checkoutUrl = action.imageUrl ?? "";
    } else if (action.kind === "embedded") {
      stripeClientSecret = action.stripeClientSecret;
      paypalOid = action.paypalOrderId;
      xenditComponentsSdkKey = action.xenditComponentsSdkKey;
    }

    const entry = Object.entries(PAYMENT_PROVIDER_IDS).find(
      ([, id]) => id === providerId,
    );
    const providerLabel = entry
      ? PAYMENT_PROVIDER_LABELS[entry[0] as PaymentProviderKey]
      : "Payment";

    const { cart: priced } = await sdk.store.cart.retrieve(cartId, {
      fields:
        "id,region_id,total,currency_code,subtotal,tax_total,shipping_total,discount_total,*items,*shipping_methods",
    } as never);
    const pricedPreview = cartToTotalsPreview(priced);
    const preview: MedusaCheckoutTotalsPreview = {
      ...pricedPreview,
      shippingOptions: ctx.shippingOptions,
      appliedShippingOptionId: ctx.appliedShippingOptionId,
    };

    const redirectOrWalletPresent =
      action.kind === "redirect" ||
      action.kind === "wallet" ||
      (action.kind === "qr" && Boolean(action.imageUrl?.startsWith("https://")));
    const embeddedPresent =
      action.kind === "embedded" &&
      Boolean(stripeClientSecret || paypalOid || xenditComponentsSdkKey);
    emitCommerceObservabilityClient("checkout_provider_action_resolved", {
      provider_id: providerId,
      region_id: regionId,
      cart_id: cartId,
      payment_session_id: typeof session?.id === "string" ? session.id : null,
      action_kind: action.kind,
      redirect_url_present: redirectOrWalletPresent,
      embedded_intent_present: embeddedPresent,
      stripe_client_secret_present: Boolean(stripeClientSecret),
      paypal_order_id_present: Boolean(paypalOid),
      xendit_components_sdk_key_present: Boolean(xenditComponentsSdkKey),
      correlation_id: preview.quoteFingerprint,
    });
    const pricedObj =
      priced && typeof priced === "object"
        ? (priced as unknown as Record<string, unknown>)
        : {};
    const confirmedTotal = preview.total;
    const currencyCode = preview.currencyCode;

    if (action.kind === "manual") {
      const amountMinor = Math.max(0, Math.floor(readMedusaCartMinorField(pricedObj, "total")));
      const medusaPaymentSessionId =
        typeof session?.id === "string" ? session.id : undefined;
      const reg = await fetch("/api/payments/checkout-intents", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "cod",
          amountMinor,
          currencyCode,
          medusaPaymentSessionId,
          quoteFingerprint: preview.quoteFingerprint,
          variantIds: preview.variantIds,
          productIds: preview.productIds,
        }),
      });
      const regJson = (await reg.json().catch(() => ({}))) as {
        correlationId?: string;
        error?: string;
      };
      if (!reg.ok || typeof regJson.correlationId !== "string" || !regJson.correlationId) {
        throw new Error(
          typeof regJson.error === "string" && regJson.error.trim()
            ? regJson.error
            : "Could not register COD checkout. Try again or contact support.",
        );
      }
      const place = await fetch("/api/checkout/cod-place-order", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correlationId: regJson.correlationId }),
      });
      const placeJson = (await place.json().catch(() => ({}))) as {
        orderId?: string;
        error?: string;
      };
      if (!place.ok || typeof placeJson.orderId !== "string" || !placeJson.orderId) {
        throw new Error(
          typeof placeJson.error === "string" && placeJson.error.trim()
            ? placeJson.error
            : "Could not place your COD order. Check shipping options and try again.",
        );
      }
      return {
        checkoutUrl: "",
        cartId,
        orderId: placeJson.orderId,
        providerLabel,
        confirmedTotal,
        currencyCode,
        confirmedPreview: preview,
        codOrderPlaced: true,
        quoteFingerprint: preview.quoteFingerprint,
        variantIds: preview.variantIds,
        productIds: preview.productIds,
        checkoutActionKind: action.kind,
      };
    }

    return {
      checkoutUrl,
      cartId,
      providerLabel,
      confirmedTotal,
      currencyCode,
      confirmedPreview: preview,
      stripeClientSecret,
      paypalOrderId: paypalOid,
      xenditComponentsSdkKey,
      paymentSessionId: typeof session?.id === "string" ? session.id : undefined,
      quoteFingerprint: preview.quoteFingerprint,
      variantIds: preview.variantIds,
      productIds: preview.productIds,
      checkoutActionKind: action.kind,
      walletUrl,
      qrImageUrl,
      qrPayload,
    };
  } catch (e) {
    if (cartId) {
      await tryDeleteStoreCart(cartId, baseUrl, publishableKey);
    }
    throw new Error(formatMedusaCheckoutError(e));
  }
}
