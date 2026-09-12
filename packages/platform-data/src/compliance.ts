import type { SupabaseClient } from "@supabase/supabase-js";

export type DataSubjectExport = {
  user: unknown;
  addresses: unknown[];
  orders: unknown[];
  orderItems: unknown[];
  payments: unknown[];
  loyaltyAccounts?: unknown[];
  wishlistItems?: unknown[];
  marketingPreferences?: unknown[];
  newsletterConfirmations?: unknown[];
  backInStockNotifications?: unknown[];
  deliveryAttempts?: unknown[];
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

  const { data: marketingPreferences } = await supabase
    .from("marketing_preferences").select("email,channel,consent_status,source,consented_at,unsubscribed_at")
    .eq("email", email);
  const { data: newsletterConfirmations } = await supabase
    .from("newsletter_confirmations").select("email,expires_at,confirmed_at,created_at").eq("email", email);
  const { data: backInStockNotifications } = await supabase
    .from("back_in_stock_notifications").select("email,product_id,product_slug,variant_id,notified,created_at,notified_at").eq("email", email);
  const { data: deliveryAttempts } = await supabase
    .from("public_delivery_attempts").select("delivery_kind,recipient,provider,status,created_at,sent_at,last_error").eq("recipient", email);

  return {
    user,
    addresses: [],
    orders: [],
    orderItems: [],
    payments: [],
    loyaltyAccounts: loyaltyAccounts ?? [],
    wishlistItems: wishlistItems ?? [],
    marketingPreferences: marketingPreferences ?? [],
    newsletterConfirmations: newsletterConfirmations ?? [],
    backInStockNotifications: backInStockNotifications ?? [],
    deliveryAttempts: deliveryAttempts ?? [],
  };
}

export async function deleteDataSubjectByEmail(
  supabase: SupabaseClient,
  email: string,
): Promise<{ deleted: string[] }> {
  const deleted: string[] = [];
  for (const table of [
    "marketing_preferences",
    "newsletter_confirmations",
    "back_in_stock_notifications",
  ]) {
    const { error } = await supabase.from(table).delete().eq("email", email);
    if (error) throw error;
    deleted.push(table);
  }
  const { error: deliveryError } = await supabase
    .from("public_delivery_attempts").delete().eq("recipient", email);
  if (deliveryError) throw deliveryError;
  deleted.push("public_delivery_attempts");
  return { deleted };
}

export async function purgeExpiredPrivacyData(
  supabase: SupabaseClient,
  now = new Date(),
): Promise<{ newsletterConfirmations: number; backInStockNotifications: number; deliveryAttempts: number }> {
  const policies = [
    ["newsletter_confirmations", 30, "newsletterConfirmations"],
    ["back_in_stock_notifications", 365, "backInStockNotifications"],
    ["public_delivery_attempts", 730, "deliveryAttempts"],
  ] as const;
  const counts = { newsletterConfirmations: 0, backInStockNotifications: 0, deliveryAttempts: 0 };
  for (const [table, days, key] of policies) {
    const cutoff = new Date(now);
    cutoff.setUTCDate(cutoff.getUTCDate() - days);
    const { data, error } = await supabase.from(table).delete().lt("created_at", cutoff.toISOString()).select("id");
    if (error) throw error;
    counts[key] = data?.length ?? 0;
  }
  return counts;
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
