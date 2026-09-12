import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingTableOrSchemaError } from "./supabase-errors.js";

type CommerceAttribution = {
  source?: string; medium?: string; campaign?: string; campaignId?: string;
  couponCode?: string; referralCode?: string;
};

export async function recordCommerceAttribution(
  supabase: SupabaseClient,
  input: { cartId: string; organizationId?: string | null; attribution: CommerceAttribution },
): Promise<void> {
  const { error } = await supabase.from("commerce_attribution").upsert({
    cart_id: input.cartId,
    organization_id: input.organizationId ?? null,
    ...input.attribution,
  }, { onConflict: "cart_id" });
  if (error && !isMissingTableOrSchemaError(error)) throw error;
}

export async function linkCommerceAttributionOrder(
  supabase: SupabaseClient,
  input: { cartId: string; orderId: string; organizationId?: string | null },
): Promise<void> {
  let query = supabase.from("commerce_attribution")
    .update({ order_id: input.orderId })
    .eq("cart_id", input.cartId);
  if (input.organizationId) query = query.eq("organization_id", input.organizationId);
  const { error } = await query;
  if (error && !isMissingTableOrSchemaError(error)) throw error;
}

export async function recordCommerceAttributionRefund(
  supabase: SupabaseClient,
  input: { orderId: string; refundId: string; amountMinor: number; currency: string; organizationId?: string | null },
): Promise<void> {
  const { error } = await supabase.from("commerce_attribution_refunds").insert({
    organization_id: input.organizationId ?? null, order_id: input.orderId, refund_id: input.refundId,
    amount_minor: input.amountMinor, currency: input.currency.toUpperCase(),
  });
  if (error && !isMissingTableOrSchemaError(error)) throw error;
}
