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
  options: { xenditConfigured: boolean },
): PaymentProviderKey[] {
  const keys = new Set(regionKeys);
  const active = connections.filter((row) => row.active === true);
  return regionKeys.filter((key) => {
    if (key === "COD") return true;
    if (key === "XENDIT") {
      return options.xenditConfigured || active.some((row) => matchesProvider(row, key));
    }
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
): Promise<PaymentProviderKey[]> {
  const supabase = createStorefrontServiceSupabase();
  const organizationId = process.env.DEFAULT_ORGANIZATION_ID?.trim();
  const xenditConfigured = Boolean(
    process.env.XENDIT_SECRET_KEY?.trim() &&
      process.env.XENDIT_WEBHOOK_TOKEN?.trim(),
  );
  if (!supabase) {
    return filterConnectedPaymentProviders(regionKeys, [], { xenditConfigured });
  }

  let query = supabase
    .from("payment_nango_connections")
    .select("organization_id,provider_config_key,provider,active");
  if (organizationId) query = query.eq("organization_id", organizationId);
  const { data, error } = await query;
  if (error) return [];

  const rows = (data ?? []) as ConnectionRow[];
  if (!organizationId) {
    const organizations = new Set(
      rows
        .map((row) => (typeof row.organization_id === "string" ? row.organization_id : ""))
        .filter(Boolean),
    );
    if (organizations.size > 1) return regionKeys.includes("COD") ? ["COD"] : [];
  }
  return filterConnectedPaymentProviders(regionKeys, rows, { xenditConfigured });
}
