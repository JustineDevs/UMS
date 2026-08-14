import type { SupabaseClient } from "@supabase/supabase-js";

export type PosOfflineCommitRow = {
  client_sale_id: string;
  medusa_order_id: string;
  display_id: string | null;
};

export async function getPosOfflineCommit(
  supabase: SupabaseClient,
  clientSaleId: string,
): Promise<PosOfflineCommitRow | null> {
  const id = clientSaleId.trim();
  if (!id) return null;
  const { data, error } = await supabase
    .from("pos_offline_commit_idempotency")
    .select("client_sale_id,medusa_order_id,display_id")
    .eq("client_sale_id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as Record<string, unknown>;
  return {
    client_sale_id: String(row.client_sale_id ?? ""),
    medusa_order_id: String(row.medusa_order_id ?? ""),
    display_id:
      row.display_id != null && String(row.display_id).trim() !== ""
        ? String(row.display_id)
        : null,
  };
}

export async function insertPosOfflineCommit(
  supabase: SupabaseClient,
  input: {
    clientSaleId: string;
    medusaOrderId: string;
    displayId: string | null;
  },
): Promise<void> {
  const { error } = await supabase.from("pos_offline_commit_idempotency").insert({
    client_sale_id: input.clientSaleId.trim(),
    medusa_order_id: input.medusaOrderId.trim(),
    display_id: input.displayId?.trim() || null,
  });
  if (error) throw error;
}

/**
 * Persists commit result after a successful Medusa order. If another request won the race
 * (unique violation), returns the existing row.
 */
export async function insertPosOfflineCommitOrRecover(
  supabase: SupabaseClient,
  input: {
    clientSaleId: string;
    medusaOrderId: string;
    displayId: string | null;
  },
): Promise<PosOfflineCommitRow> {
  try {
    await insertPosOfflineCommit(supabase, input);
  } catch (e) {
    const code =
      e && typeof e === "object" && "code" in e
        ? String((e as { code?: string }).code ?? "")
        : "";
    if (code === "23505") {
      const row = await getPosOfflineCommit(supabase, input.clientSaleId);
      if (row) return row;
    }
    throw e;
  }
  const row = await getPosOfflineCommit(supabase, input.clientSaleId);
  if (!row) {
    throw new Error("pos_offline_commit_idempotency insert did not persist");
  }
  return row;
}
