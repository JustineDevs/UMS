export const PAYMENT_CHECKOUT_CORRELATION_STORAGE_KEY =
  "payment_checkout_correlation_id";

export type HostedReturnProvider = "stripe" | "paypal" | "xendit";
export type HostedReturnStatus = "success" | "cancel" | "failure";

const PROVIDER_LABELS: Record<HostedReturnProvider, string> = {
  stripe: "Stripe",
  paypal: "PayPal",
  xendit: "Xendit",
};

export function normalizeHostedReturnProvider(
  raw: string | undefined,
): HostedReturnProvider {
  const value = raw?.trim().toLowerCase();
  if (value === "paypal" || value === "xendit") {
    return value;
  }
  return "stripe";
}

export function normalizeHostedReturnStatus(
  raw: string | undefined,
): HostedReturnStatus {
  const value = raw?.trim().toLowerCase();
  if (value === "cancel" || value === "failure") {
    return value;
  }
  return "success";
}

export function providerLabelForHostedReturn(
  provider: HostedReturnProvider,
): string {
  return PROVIDER_LABELS[provider];
}

export function buildHostedReturnMissingCorrelationMessage(
  provider: HostedReturnProvider,
): string {
  return `We couldn't match this ${providerLabelForHostedReturn(
    provider,
  )} payment to your checkout session. Return to checkout to review your payment status, or check your account in a few minutes.`;
}

export function buildHostedReturnStatusMessage(
  provider: HostedReturnProvider,
  status: Exclude<HostedReturnStatus, "success">,
): string {
  if (status === "cancel") {
    return `You left ${providerLabelForHostedReturn(
      provider,
    )} before completing payment. Your bag is unchanged. Review checkout and continue when you are ready.`;
  }
  return `${providerLabelForHostedReturn(
    provider,
  )} did not confirm your payment. Review checkout and try again, or choose another payment option.`;
}

export function checkoutReviewHref(message: string): string {
  return `/checkout?review=1&message=${encodeURIComponent(message)}`;
}
