import type { PaymentProviderKey } from "./medusa-checkout";
import { createStorefrontServiceSupabase } from "./storefront-supabase";

type ConnectionRow = {
  organization_id?: unknown;
  provider_config_key?: unknown;
  provider?: unknown;
  active?: unknown;
};

function matchesProvider(row: ConnectionRow, provider: PaymentProviderKey): boolean {
  const value = `${String(row.provider ?? "")} ${String(row.provider_config_key ?? "")}`.toLowerCase();
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
  const keys = new Set(regionKeys);
  const organizationId = options.organizationId?.trim();
  const active = connections.filter(
    (row) =>
      row.active === true &&
      (!organizationId || String(row.organization_id ?? "").trim() === organizationId),
  );
  return regionKeys.filter((key) => {
    if (key === "COD") return true;
    if (key === "XENDIT") {
      return options.xenditConfigured || active.some((row) => matchesProvider(row, key));
    }
    if (key === "STRIPE" && options.stripeConfigured) return true;
    if (key === "PAYPAL" && options.paypalConfigured) return true;
    return active.some((row) => matchesProvider(row, key));
  }).filter((key) => keys.has(key));
}

/**
 * Wallets are enabled by the store's active connection ledger, not by a public
 * client flag. A deployment with multiple organizations must configure the
 * default organization explicitly; otherwise no wallet is exposed.
 */
export async function resolveStorePaymentProviders(
  regionKeys: PaymentProviderKey[],
  context?: { organizationId?: string | null },
): Promise<PaymentProviderKey[]> {
  const supabase = createStorefrontServiceSupabase();
  const directCredentialsAllowed =
    process.env.NODE_ENV !== "production" ||
    process.env.E2E_ALLOW_DIRECT_PAYMENT_CREDENTIALS === "true";
  const organizationId =
    context?.organizationId?.trim() || process.env.DEFAULT_ORGANIZATION_ID?.trim();
  const xenditConfigured = directCredentialsAllowed && Boolean(
    process.env.XENDIT_SECRET_KEY?.trim() &&
      process.env.XENDIT_WEBHOOK_TOKEN?.trim(),
  );
  const stripeConfigured = directCredentialsAllowed && Boolean(process.env.STRIPE_API_KEY?.trim());
  const paypalConfigured = directCredentialsAllowed && Boolean(
    process.env.PAYPAL_CLIENT_ID?.trim() &&
      process.env.PAYPAL_CLIENT_SECRET?.trim() &&
      process.env.PAYPAL_ENVIRONMENT?.trim().toLowerCase() === "sandbox",
  );
  if (!supabase || !organizationId) {
    return regionKeys.includes("COD") ? ["COD"] : [];
  }

  let query = supabase
    .from("payment_nango_connections")
    .select("organization_id,provider_config_key,provider,active");
  if (organizationId) query = query.eq("organization_id", organizationId);
  const { data, error } = await query;
  if (error) return [];

  const rows = (data ?? []) as ConnectionRow[];
  return filterConnectedPaymentProviders(regionKeys, rows, {
    organizationId,
    xenditConfigured,
    stripeConfigured,
    paypalConfigured,
  });
}
