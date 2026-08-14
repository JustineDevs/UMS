import type { SupabaseClient } from "@supabase/supabase-js";

export type DataSubjectExport = {
  user: unknown;
  addresses: unknown[];
  orders: unknown[];
  orderItems: unknown[];
  payments: unknown[];
  loyaltyAccounts?: unknown[];
  wishlistItems?: unknown[];
};

const ANONYMIZED_SENTINEL = "ANONYMIZED";

/**
 * Export data subject by email. Aggregates all Supabase-owned PII tables.
 * Commerce data (orders, addresses, payments) lives in Medusa; the DSAR
 * caller must separately query Medusa Admin API for those if required.
 * Creates a compliance_requests audit record.
 */
export async function exportDataSubjectByEmail(
  supabase: SupabaseClient,
  email: string
): Promise<DataSubjectExport | null> {
  const { data: user, error: uErr } = await supabase
    .from("users")
    .select("*")
    .eq("email", email)
    .maybeSingle();
  if (uErr) throw uErr;
  if (!user) return null;

  const requestId = crypto.randomUUID();
  await supabase.from("compliance_requests").insert({
    id: requestId,
    type: "dsar_export",
    requestor_email: email,
    status: "completed",
  });

  const { data: loyaltyAccounts } = await supabase
    .from("loyalty_accounts")
    .select("id,customer_email,points_balance,lifetime_points,tier,created_at,updated_at")
    .eq("customer_email", email);

  const { data: wishlistItems } = await supabase
    .from("wishlists")
    .select("product_slug,product_name,added_at")
    .eq("medusa_customer_id", (user as Record<string, unknown>).medusa_customer_id as string ?? "");

  return {
    user,
    addresses: [],
    orders: [],
    orderItems: [],
    payments: [],
    loyaltyAccounts: loyaltyAccounts ?? [],
    wishlistItems: wishlistItems ?? [],
  };
}

/**
 * PH-04: Anonymize Supabase-owned PII for orders/profiles older than the
 * given ISO timestamp. Commerce PII in Medusa is outside this function's scope.
 *
 * Tables anonymized:
 *   - storefront_profiles: redacts phone, date_of_birth for stale accounts
 *   - loyalty_accounts: redacts customer_email for inactive stale accounts
 *
 * Returns the count of rows updated across all affected tables.
 */
export async function anonymizeStaleOrderAddresses(
  supabase: SupabaseClient,
  olderThanIso: string
): Promise<{ addressesUpdated: number }> {
  let updated = 0;

  try {
    const { data: staleProfiles, error: pErr } = await supabase
      .from("storefront_profiles")
      .select("id")
      .lt("updated_at", olderThanIso)
      .neq("phone", ANONYMIZED_SENTINEL);

    if (!pErr && staleProfiles && staleProfiles.length > 0) {
      const ids = (staleProfiles as Array<{ id: string }>).map((r) => r.id);
      const BATCH = 200;
      for (let i = 0; i < ids.length; i += BATCH) {
        const chunk = ids.slice(i, i + BATCH);
        await supabase
          .from("storefront_profiles")
          .update({
            phone: ANONYMIZED_SENTINEL,
            date_of_birth: null,
          })
          .in("id", chunk);
        updated += chunk.length;
      }
    }
  } catch {
    /* log but do not fail; other tables still processed */
  }

  try {
    const { data: staleLoyalty, error: lErr } = await supabase
      .from("loyalty_accounts")
      .select("id")
      .lt("updated_at", olderThanIso)
      .neq("customer_email", ANONYMIZED_SENTINEL)
      .eq("points_balance", 0);

    if (!lErr && staleLoyalty && staleLoyalty.length > 0) {
      const ids = (staleLoyalty as Array<{ id: string }>).map((r) => r.id);
      const BATCH = 200;
      for (let i = 0; i < ids.length; i += BATCH) {
        const chunk = ids.slice(i, i + BATCH);
        await supabase
          .from("loyalty_accounts")
          .update({ customer_email: ANONYMIZED_SENTINEL })
          .in("id", chunk);
        updated += chunk.length;
      }
    }
  } catch {
    /* log but do not fail */
  }

  return { addressesUpdated: updated };
}
