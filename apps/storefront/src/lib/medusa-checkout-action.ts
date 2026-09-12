/**
 * Pure helpers for Medusa payment session selection and provider-specific checkout shape.
 * Keeps browser checkout honest: no silent fallback to another provider's session.
 */

export type MedusaPaymentSessionLike = {
  id?: string;
  provider_id?: string;
  data?: Record<string, unknown>;
};

export type CheckoutAction =
  | { kind: "redirect"; url: string; providerPaymentId?: string }
  | { kind: "wallet"; url: string }
  | {
      kind: "qr";
      imageUrl?: string;
      payload?: string;
    }
  | {
      kind: "embedded";
      providerId: string;
      stripeClientSecret?: string;
      paypalOrderId?: string;
      xenditComponentsSdkKey?: string;
      paymentSessionId?: string;
    }
  | { kind: "manual"; providerId: string; paymentSessionId: string }
  | { kind: "error"; message: string };

function isCodProviderId(providerId: string): boolean {
  return providerId === "pp_cod_cod" || providerId.includes("cod_cod");
}

export function pickPaymentSessionForProvider(
  sessions: MedusaPaymentSessionLike[],
  providerId: string,
): MedusaPaymentSessionLike | null {
  const match = sessions.find((s) => s.provider_id === providerId);
  return match ?? null;
}

export function resolveCheckoutAction(
  providerId: string,
  session: MedusaPaymentSessionLike | null | undefined,
): CheckoutAction {
  if (!session || session.provider_id !== providerId) {
    return {
      kind: "error",
      message: session
        ? `Payment session provider mismatch: expected ${providerId}, got ${String(session.provider_id)}.`
        : `No payment session returned for provider ${providerId}.`,
    };
  }

  const data = session.data ?? {};

  if (isCodProviderId(providerId) || data.cod === true) {
    const paymentSessionId = typeof session.id === "string" ? session.id : "";
    if (!paymentSessionId) {
      return { kind: "error", message: "COD payment session missing id." };
    }
    return { kind: "manual", providerId, paymentSessionId };
  }

  const walletUrlRaw =
    typeof data.wallet_url === "string"
      ? data.wallet_url
      : typeof data.wallet_redirect_url === "string"
        ? data.wallet_redirect_url
        : "";
  if (walletUrlRaw && walletUrlRaw.startsWith("https://")) {
    return { kind: "wallet", url: walletUrlRaw };
  }

  const qrImage =
    typeof data.qr_image_url === "string" && data.qr_image_url.startsWith("https://")
      ? data.qr_image_url
      : undefined;
  const qrPayload =
    typeof data.qr_code === "string" && data.qr_code.trim().length > 0
      ? data.qr_code.trim()
      : undefined;
  if (qrImage || qrPayload) {
    return { kind: "qr", imageUrl: qrImage, payload: qrPayload };
  }

  const checkoutUrlRaw =
    typeof data.checkout_url === "string"
      ? data.checkout_url
      : typeof data.approval_url === "string"
        ? data.approval_url
        : "";

  const xenditComponentsSdkKey =
    typeof data.components_sdk_key === "string" && data.components_sdk_key.trim()
      ? data.components_sdk_key.trim()
      : undefined;
  if (providerId.toLowerCase().includes("xendit") && xenditComponentsSdkKey) {
    return {
      kind: "embedded",
      providerId,
      xenditComponentsSdkKey,
      paymentSessionId: typeof session.id === "string" ? session.id : undefined,
    };
  }

  if (checkoutUrlRaw && checkoutUrlRaw.startsWith("https://")) {
    const providerPaymentId =
      providerId.toLowerCase().includes("stripe") &&
      typeof data.stripe_checkout_session_id === "string" &&
      data.stripe_checkout_session_id.trim()
        ? data.stripe_checkout_session_id.trim()
        : providerId.toLowerCase().includes("stripe")
          ? checkoutUrlRaw.match(/\/c\/pay\/(cs_[A-Za-z0-9_]+)/)?.[1]
          : undefined;
    return { kind: "redirect", url: checkoutUrlRaw, providerPaymentId };
  }

  const isStripe = providerId.toLowerCase().includes("stripe");
  const stripeClientSecret =
    typeof data.client_secret === "string" ? data.client_secret : undefined;
  if (isStripe && stripeClientSecret) {
    return {
      kind: "error",
      message:
        "Stripe Payment Element (client_secret) is not supported on this storefront. Use Stripe Checkout (hosted redirect) from Medusa.",
    };
  }

  const paypalOrderId =
    typeof data.paypal_order_id === "string"
      ? data.paypal_order_id
      : typeof data.id === "string" && providerId.includes("paypal")
        ? data.id
        : undefined;

  if (paypalOrderId) {
    return {
      kind: "embedded",
      providerId,
      stripeClientSecret: undefined,
      paypalOrderId,
      paymentSessionId: typeof session.id === "string" ? session.id : undefined,
    };
  }

  return {
    kind: "error",
    message: `Payment session for ${providerId} did not return a valid HTTPS checkout URL or embedded payment data.`,
  };
}
