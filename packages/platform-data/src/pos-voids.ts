import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingTableOrSchemaError } from "./supabase-errors.js";

export type VoidAction = "void_item" | "void_order" | "refund" | "discount_override";

export type PosVoid = {
  id: string;
  shift_id: string | null;
  employee_id: string;
  approved_by: string | null;
  order_id: string | null;
  line_item_id: string | null;
  action: VoidAction;
  amount: number | null;
  reason: string | null;
  pin_verified: boolean;
  created_at: string;
};

function rowToVoid(row: Record<string, unknown>): PosVoid {
  return {
    id: String(row.id ?? ""),
    shift_id: row.shift_id != null ? String(row.shift_id) : null,
    employee_id: String(row.employee_id ?? ""),
    approved_by: row.approved_by != null ? String(row.approved_by) : null,
    order_id: row.order_id != null ? String(row.order_id) : null,
    line_item_id: row.line_item_id != null ? String(row.line_item_id) : null,
    action: (row.action as VoidAction) ?? "void_item",
    amount: row.amount != null ? Number(row.amount) : null,
    reason: row.reason != null ? String(row.reason) : null,
    pin_verified: Boolean(row.pin_verified),
    created_at: String(row.created_at ?? new Date().toISOString()),
  };
}

export type RecordVoidInput = {
  organization_id?: string;
  shift_id?: string;
  employee_id: string;
  approved_by?: string;
  order_id?: string;
  line_item_id?: string;
  action: VoidAction;
  amount?: number;
  reason?: string;
  pin_verified?: boolean;
};

export async function recordVoid(
  supabase: SupabaseClient,
  input: RecordVoidInput,
): Promise<PosVoid> {
  const { data, error } = await supabase
    .from("pos_voids")
    .insert({
      organization_id: input.organization_id ?? null,
      shift_id: input.shift_id ?? null,
      employee_id: input.employee_id,
      approved_by: input.approved_by ?? null,
      order_id: input.order_id ?? null,
      medusa_order_id: input.order_id ?? null,
      line_item_id: input.line_item_id ?? null,
      action: input.action,
      amount: input.amount ?? null,
      reason: input.reason ?? null,
      pin_verified: input.pin_verified ?? false,
    })
    .select("*")
    .single();
  if (error) throw error;
  return rowToVoid(data as Record<string, unknown>);
}

export async function listVoids(
  supabase: SupabaseClient,
  opts?: { shiftId?: string; limit?: number; organizationId?: string },
): Promise<PosVoid[]> {
  let q = supabase
    .from("pos_voids")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(opts?.limit ?? 100);
  if (opts?.shiftId) {
    q = q.eq("shift_id", opts.shiftId);
  }
  if (opts?.organizationId) q = q.eq("organization_id", opts.organizationId);
  const { data, error } = await q;
  if (error) {
    if (isMissingTableOrSchemaError(error)) return [];
    throw error;
  }
  return (data ?? []).map((r) => rowToVoid(r as Record<string, unknown>));
}
