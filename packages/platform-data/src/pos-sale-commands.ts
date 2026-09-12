import type { SupabaseClient } from "@supabase/supabase-js";

export type PosSaleCommand = {
  organization_id: string;
  idempotency_key: string;
  offline_sale_id: string | null;
  status: "pending" | "committed";
  medusa_order_id: string | null;
  order_number: string | null;
};

function rowToCommand(row: Record<string, unknown>): PosSaleCommand {
  return {
    organization_id: String(row.organization_id ?? ""),
    idempotency_key: String(row.idempotency_key ?? ""),
    offline_sale_id: row.offline_sale_id == null ? null : String(row.offline_sale_id),
    status: row.status === "committed" ? "committed" : "pending",
    medusa_order_id: row.medusa_order_id == null ? null : String(row.medusa_order_id),
    order_number: row.order_number == null ? null : String(row.order_number),
  };
}

export async function getPosSaleCommand(supabase: SupabaseClient, organizationId: string, idempotencyKey: string, offlineSaleId?: string): Promise<PosSaleCommand | null> {
  const columns = "organization_id,idempotency_key,offline_sale_id,status,medusa_order_id,order_number";
  let query = supabase.from("pos_sale_commands").select(columns).eq("organization_id", organizationId.trim()).eq("idempotency_key", idempotencyKey.trim());
  let { data, error } = await query.limit(1).maybeSingle();
  if (error) throw error;
  if (!data && offlineSaleId?.trim()) {
    ({ data, error } = await supabase.from("pos_sale_commands").select(columns).eq("organization_id", organizationId.trim()).eq("offline_sale_id", offlineSaleId.trim()).limit(1).maybeSingle());
    if (error) throw error;
  }
  return data ? rowToCommand(data as Record<string, unknown>) : null;
}

export async function claimPosSaleCommand(supabase: SupabaseClient, input: { organizationId: string; idempotencyKey: string; offlineSaleId?: string }): Promise<"claimed" | "pending" | "committed"> {
  const existing = await getPosSaleCommand(supabase, input.organizationId, input.idempotencyKey, input.offlineSaleId);
  if (existing) return existing.status;
  const { error } = await supabase.from("pos_sale_commands").insert({ organization_id: input.organizationId.trim(), idempotency_key: input.idempotencyKey.trim(), offline_sale_id: input.offlineSaleId?.trim() || null, status: "pending" });
  if (!error) return "claimed";
  if (error.code !== "23505") throw error;
  const raced = await getPosSaleCommand(supabase, input.organizationId, input.idempotencyKey, input.offlineSaleId);
  return raced?.status ?? "pending";
}

export async function completePosSaleCommand(supabase: SupabaseClient, input: { organizationId: string; idempotencyKey: string; orderId: string; orderNumber: string }): Promise<void> {
  const { error } = await supabase.from("pos_sale_commands").update({ status: "committed", medusa_order_id: input.orderId, order_number: input.orderNumber, completed_at: new Date().toISOString() }).eq("organization_id", input.organizationId.trim()).eq("idempotency_key", input.idempotencyKey.trim());
  if (error) throw error;
}
