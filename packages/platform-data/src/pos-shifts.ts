import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingTableOrSchemaError } from "./supabase-errors.js";

export type PosShift = {
  id: string;
  employee_id: string;
  device_name: string;
  opened_at: string;
  closed_at: string | null;
  opening_cash: number;
  closing_cash: number | null;
  expected_cash: number | null;
  notes: string | null;
  status: "open" | "closed";
};

function rowToShift(row: Record<string, unknown>): PosShift {
  return {
    id: String(row.id ?? ""),
    employee_id: String(row.employee_id ?? ""),
    device_name: String(row.device_name ?? "Terminal 01"),
    opened_at: String(row.opened_at ?? new Date().toISOString()),
    closed_at: row.closed_at != null ? String(row.closed_at) : null,
    opening_cash: Number(row.opening_cash ?? 0),
    closing_cash: row.closing_cash != null ? Number(row.closing_cash) : null,
    expected_cash: row.expected_cash != null ? Number(row.expected_cash) : null,
    notes: row.notes != null ? String(row.notes) : null,
    status: row.status === "closed" ? "closed" : "open",
  };
}

export async function openShift(
  supabase: SupabaseClient,
  input: { employee_id: string; organization_id: string; device_name?: string; opening_cash?: number },
): Promise<PosShift> {
  const { data, error } = await supabase
    .from("pos_shifts")
    .insert({
      employee_id: input.employee_id,
      organization_id: input.organization_id,
      device_name: input.device_name ?? "Terminal 01",
      opening_cash: input.opening_cash ?? 0,
      status: "open",
    })
    .select("*")
    .single();
  if (error) throw error;
  return rowToShift(data as Record<string, unknown>);
}

export async function closeShift(
  supabase: SupabaseClient,
  shiftId: string,
  input: { organization_id: string; closing_cash: number; expected_cash?: number; notes?: string },
): Promise<PosShift> {
  const { data, error } = await supabase
    .from("pos_shifts")
    .update({
      closed_at: new Date().toISOString(),
      closing_cash: input.closing_cash,
      expected_cash: input.expected_cash ?? null,
      notes: input.notes ?? null,
      status: "closed",
    })
    .eq("id", shiftId)
    .eq("organization_id", input.organization_id)
    .select("*")
    .single();
  if (error) throw error;
  return rowToShift(data as Record<string, unknown>);
}

export async function getActiveShift(
  supabase: SupabaseClient,
  employeeId: string,
  organizationId?: string,
): Promise<PosShift | null> {
  let query = supabase
    .from("pos_shifts")
    .select("*")
    .eq("employee_id", employeeId)
    .eq("status", "open")
    .order("opened_at", { ascending: false })
    .limit(1)
  if (organizationId) query = query.eq("organization_id", organizationId);
  const { data, error } = await query.maybeSingle();
  if (error) {
    if (isMissingTableOrSchemaError(error)) return null;
    throw error;
  }
  if (!data) return null;
  return rowToShift(data as Record<string, unknown>);
}

export async function getShiftById(
  supabase: SupabaseClient,
  shiftId: string,
  organizationId?: string,
): Promise<PosShift | null> {
  let query = supabase
    .from("pos_shifts")
    .select("*")
    .eq("id", shiftId)
  if (organizationId) query = query.eq("organization_id", organizationId);
  const { data, error } = await query.maybeSingle();
  if (error) {
    if (isMissingTableOrSchemaError(error)) return null;
    throw error;
  }
  if (!data) return null;
  return rowToShift(data as Record<string, unknown>);
}

export async function listShifts(
  supabase: SupabaseClient,
  opts?: { limit?: number; status?: "open" | "closed"; organizationId?: string },
): Promise<PosShift[]> {
  let q = supabase
    .from("pos_shifts")
    .select("*")
    .order("opened_at", { ascending: false })
    .limit(opts?.limit ?? 50);
  if (opts?.status) {
    q = q.eq("status", opts.status);
  }
  if (opts?.organizationId) q = q.eq("organization_id", opts.organizationId);
  const { data, error } = await q;
  if (error) {
    if (isMissingTableOrSchemaError(error)) return [];
    throw error;
  }
  return (data ?? []).map((r) => rowToShift(r as Record<string, unknown>));
}
