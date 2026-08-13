export type PaymentProvider = "stripe" | "paypal" | "xendit";

export type PaymentCapability =
  | "hosted_checkout"
  | "payment_links"
  | "embedded_checkout"
  | "catalog_sync"
  | "recurring_billing"
  | "save_payment_method"
  | "authorize"
  | "capture"
  | "partial_capture"
  | "refund"
  | "partial_refund"
  | "void"
  | "invoices"
  | "disputes"
  | "payouts"
  | "connected_accounts"
  | "channel_discovery"
  | "future_charge";

export type PaymentProviderCapabilities = {
  provider: PaymentProvider;
  /** Provider API surface that exists, independent of whether UVS has wired it. */
  capabilities: readonly PaymentCapability[];
  /** UVS operations that are currently executable end to end. */
  implementedCapabilities: readonly PaymentCapability[];
  /** UI may only expose these after the route and provider artifact lifecycle are verified. */
  verifiedCapabilities: readonly PaymentCapability[];
  checkoutModes: readonly ("hosted" | "embedded")[];
  notes: string;
};

export const PAYMENT_PROVIDER_CAPABILITIES: readonly PaymentProviderCapabilities[] =
  [
    {
      provider: "stripe",
      capabilities: [
        "hosted_checkout",
        "payment_links",
        "embedded_checkout",
        "catalog_sync",
        "recurring_billing",
        "save_payment_method",
        "authorize",
        "capture",
        "partial_capture",
        "refund",
        "partial_refund",
        "void",
        "invoices",
        "disputes",
        "payouts",
        "connected_accounts",
      ],
      implementedCapabilities: [
        "hosted_checkout",
        "authorize",
        "capture",
        "refund",
        "partial_refund",
        "void",
      ],
      verifiedCapabilities: [
        "hosted_checkout",
        "authorize",
        "capture",
        "refund",
        "partial_refund",
        "void",
      ],
      checkoutModes: ["hosted"],
      notes:
        "Products and immutable Prices are reusable across Checkout, Links, Invoices, and Subscriptions.",
    },
    {
      provider: "paypal",
      capabilities: [
        "hosted_checkout",
        "payment_links",
        "recurring_billing",
        "authorize",
        "capture",
        "partial_capture",
        "refund",
        "partial_refund",
        "void",
        "invoices",
        "disputes",
        "payouts",
        "connected_accounts",
      ],
      implementedCapabilities: [
        "hosted_checkout",
        "authorize",
        "capture",
        "refund",
        "partial_refund",
      ],
      verifiedCapabilities: [
        "hosted_checkout",
        "authorize",
        "capture",
        "refund",
        "partial_refund",
      ],
      checkoutModes: ["hosted"],
      notes:
        "Orders and wallet approval are separate from Payment Links, Invoicing, Subscriptions, Payouts, and Disputes APIs.",
    },
    {
      provider: "xendit",
      capabilities: [
        "hosted_checkout",
        "embedded_checkout",
        "save_payment_method",
        "authorize",
        "capture",
        "refund",
        "partial_refund",
        "payouts",
        "channel_discovery",
        "future_charge",
      ],
      implementedCapabilities: [
        "hosted_checkout",
        "capture",
        "refund",
        "partial_refund",
      ],
      verifiedCapabilities: [
        "hosted_checkout",
        "capture",
        "refund",
        "partial_refund",
      ],
      checkoutModes: ["hosted", "embedded"],
      notes:
        "Payment Sessions expose PAYMENT_LINK or COMPONENTS modes and PAY, SAVE, or PAY_AND_SAVE session types.",
    },
  ];

export function getPaymentProviderCapabilities(
  provider: PaymentProvider,
): PaymentProviderCapabilities {
  const result = PAYMENT_PROVIDER_CAPABILITIES.find(
    (item) => item.provider === provider,
  );
  if (!result) throw new Error(`Unsupported payment provider: ${provider}`);
  return result;
}

export function paymentProviderSupports(
  provider: PaymentProvider,
  capability: PaymentCapability,
): boolean {
  return getPaymentProviderCapabilities(provider).capabilities.includes(
    capability,
  );
}
