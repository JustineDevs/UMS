import type { PaymentProviderKey } from "./checkout-worker";

type ConnectionRow = {
  organization_id?: unknown;
  provider_config_key?: unknown;
  provider?: unknown;
  active?: unknown;
};

function matchesProvider(
  row: ConnectionRow,
  provider: PaymentProviderKey,
): boolean {
  const value =
    `${String(row.provider ?? "")} ${String(row.provider_config_key ?? "")}`.toLowerCase();
  return value.includes(provider.toLowerCase());
}

export function filterConnectedPaymentProviders(
  regionKeys: PaymentProviderKey[],
  connections: ConnectionRow[],
  options: {
    organizationId?: string;
    xenditConfigured: boolean;
    stripeConfigured?: boolean;
    paypalConfigured?: boolean;
  },
): PaymentProviderKey[] {
  const organizationId = options.organizationId?.trim();
  const active = connections.filter(
    (row) =>
      row.active === true &&
      (!organizationId ||
        String(row.organization_id ?? "").trim() === organizationId),
  );
  return regionKeys.filter((key) => {
      if (key === "COD") return true;
      if (key === "XENDIT") {
        return (
          options.xenditConfigured ||
          active.some((row) => matchesProvider(row, key))
        );
      }
      if (key === "STRIPE" && options.stripeConfigured) return true;
      if (key === "PAYPAL" && options.paypalConfigured) return true;
      return active.some((row) => matchesProvider(row, key));
    });
}
