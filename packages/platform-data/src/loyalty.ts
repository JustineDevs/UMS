import type { SupabaseClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";
import { isMissingTableOrSchemaError } from "./supabase-errors.js";

export type LoyaltyTier = "standard" | "silver" | "gold" | "platinum";

export type LoyaltyAccount = {
  id: string;
  customer_email: string;
  medusa_customer_id: string | null;
  points_balance: number;
  lifetime_points: number;
  tier: LoyaltyTier;
  birthday: string | null;
  phone: string | null;
  qr_token: string | null;
  created_at: string;
  updated_at: string;
};

function rowToAccount(row: Record<string, unknown>): LoyaltyAccount {
  return {
    id: String(row.id ?? ""),
    customer_email: String(row.customer_email ?? ""),
    medusa_customer_id:
      row.medusa_customer_id != null ? String(row.medusa_customer_id) : null,
    points_balance: Number(row.points_balance ?? 0),
    lifetime_points: Number(row.lifetime_points ?? 0),
    tier: (row.tier as LoyaltyTier) ?? "standard",
    birthday: row.birthday != null ? String(row.birthday) : null,
    phone: row.phone != null ? String(row.phone) : null,
    qr_token: row.qr_token != null ? String(row.qr_token) : null,
    created_at: String(row.created_at ?? new Date().toISOString()),
    updated_at: String(row.updated_at ?? new Date().toISOString()),
  };
}

export async function getOrCreateLoyaltyAccount(
  supabase: SupabaseClient,
  email: string,
  medusaCustomerId?: string,
): Promise<LoyaltyAccount> {
  const { data: existing } = await supabase
    .from("loyalty_accounts")
    .select("*")
    .eq("customer_email", email)
    .maybeSingle();
  if (existing) return rowToAccount(existing as Record<string, unknown>);

  const qrToken = randomBytes(16).toString("hex");
  const { data, error } = await supabase
    .from("loyalty_accounts")
    .insert({
      customer_email: email,
      medusa_customer_id: medusaCustomerId ?? null,
      qr_token: qrToken,
    })
    .select("*")
    .single();
  if (error) throw error;
  return rowToAccount(data as Record<string, unknown>);
}

export async function lookupByQr(
  supabase: SupabaseClient,
  qrToken: string,
): Promise<LoyaltyAccount | null> {
  const { data, error } = await supabase
    .from("loyalty_accounts")
    .select("*")
    .eq("qr_token", qrToken)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return rowToAccount(data as Record<string, unknown>);
}

export async function lookupByPhone(
  supabase: SupabaseClient,
  phone: string,
): Promise<LoyaltyAccount | null> {
  const { data, error } = await supabase
    .from("loyalty_accounts")
    .select("*")
    .eq("phone", phone)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return rowToAccount(data as Record<string, unknown>);
}

export async function addPoints(
  supabase: SupabaseClient,
  accountId: string,
  points: number,
  reason: string,
  orderId?: string,
): Promise<LoyaltyAccount> {
  const { error: txError } = await supabase.from("loyalty_transactions").insert({
    loyalty_account_id: accountId,
    points_delta: points,
    reason,
    order_id: orderId ?? null,
    medusa_order_id: orderId ?? null,
  });
  if (txError) throw txError;

  const { data, error } = await supabase.rpc("increment_loyalty_points", {
    p_account_id: accountId,
    p_delta: points,
  });

  if (error) {
    const { data: acct, error: fetchErr } = await supabase
      .from("loyalty_accounts")
      .select("points_balance, lifetime_points")
      .eq("id", accountId)
      .single();
    if (fetchErr) throw fetchErr;
    const newBalance = Number(acct.points_balance) + points;
    const newLifetime =
      points > 0
        ? Number(acct.lifetime_points) + points
        : Number(acct.lifetime_points);
    const tier = computeTier(newLifetime);
    const { data: updated, error: updErr } = await supabase
      .from("loyalty_accounts")
      .update({
        points_balance: newBalance,
        lifetime_points: newLifetime,
        tier,
        updated_at: new Date().toISOString(),
      })
      .eq("id", accountId)
      .select("*")
      .single();
    if (updErr) throw updErr;
    return rowToAccount(updated as Record<string, unknown>);
  }

  const { data: updated, error: updErr } = await supabase
    .from("loyalty_accounts")
    .select("*")
    .eq("id", accountId)
    .single();
  if (updErr) throw updErr;
  return rowToAccount((data ?? updated) as Record<string, unknown>);
}

export async function redeemPoints(
  supabase: SupabaseClient,
  accountId: string,
  points: number,
  reason: string,
): Promise<LoyaltyAccount> {
  const { data: acct, error: fetchErr } = await supabase
    .from("loyalty_accounts")
    .select("points_balance")
    .eq("id", accountId)
    .single();
  if (fetchErr) throw fetchErr;
  if (Number(acct.points_balance) < points) {
    throw new Error("Insufficient points");
  }
  return addPoints(supabase, accountId, -points, reason);
}

function computeTier(lifetimePoints: number): LoyaltyTier {
  if (lifetimePoints >= 10000) return "platinum";
  if (lifetimePoints >= 5000) return "gold";
  if (lifetimePoints >= 1000) return "silver";
  return "standard";
}

export async function listLoyaltyAccounts(
  supabase: SupabaseClient,
  opts?: { tier?: LoyaltyTier; limit?: number },
): Promise<LoyaltyAccount[]> {
  let q = supabase
    .from("loyalty_accounts")
    .select("*")
    .order("lifetime_points", { ascending: false })
    .limit(opts?.limit ?? 100);
  if (opts?.tier) {
    q = q.eq("tier", opts.tier);
  }
  const { data, error } = await q;
  if (error) {
    if (isMissingTableOrSchemaError(error)) return [];
    throw error;
  }
  return (data ?? []).map((r) => rowToAccount(r as Record<string, unknown>));
}
