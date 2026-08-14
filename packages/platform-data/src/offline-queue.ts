import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingTableOrSchemaError } from "./supabase-errors.js";

export type OfflineQueueItem = {
  id: string;
  device_name: string;
  employee_id: string | null;
  payload: Record<string, unknown>;
  status: "pending" | "synced" | "failed";
  error_message: string | null;
  created_at: string;
  synced_at: string | null;
};

function rowToItem(row: Record<string, unknown>): OfflineQueueItem {
  return {
    id: String(row.id ?? ""),
    device_name: String(row.device_name ?? ""),
    employee_id: row.employee_id != null ? String(row.employee_id) : null,
    payload: (row.payload as Record<string, unknown>) ?? {},
    status: (row.status as OfflineQueueItem["status"]) ?? "pending",
    error_message: row.error_message != null ? String(row.error_message) : null,
    created_at: String(row.created_at ?? new Date().toISOString()),
    synced_at: row.synced_at != null ? String(row.synced_at) : null,
  };
}

export async function enqueueOfflineSale(
  supabase: SupabaseClient,
  input: {
    device_name: string;
    employee_id?: string;
    payload: Record<string, unknown>;
  },
): Promise<OfflineQueueItem> {
  const { data, error } = await supabase
    .from("offline_pos_queue")
    .insert({
      device_name: input.device_name,
      employee_id: input.employee_id ?? null,
      payload: input.payload,
      status: "pending",
    })
    .select("*")
    .single();
  if (error) throw error;
  return rowToItem(data as Record<string, unknown>);
}

export async function listPendingQueue(
  supabase: SupabaseClient,
  opts?: { deviceName?: string; limit?: number },
): Promise<OfflineQueueItem[]> {
  let q = supabase
    .from("offline_pos_queue")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(opts?.limit ?? 100);
  if (opts?.deviceName) {
    q = q.eq("device_name", opts.deviceName);
  }
  const { data, error } = await q;
  if (error) {
    if (isMissingTableOrSchemaError(error)) return [];
    throw error;
  }
  return (data ?? []).map((r) => rowToItem(r as Record<string, unknown>));
}

export async function markSynced(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await supabase
    .from("offline_pos_queue")
    .update({ status: "synced", synced_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function markFailed(
  supabase: SupabaseClient,
  id: string,
  errorMessage: string,
): Promise<void> {
  const { error } = await supabase
    .from("offline_pos_queue")
    .update({ status: "failed", error_message: errorMessage })
    .eq("id", id);
  if (error) throw error;
}

export async function retryFailed(
  supabase: SupabaseClient,
): Promise<number> {
  const { data, error } = await supabase
    .from("offline_pos_queue")
    .update({ status: "pending", error_message: null })
    .eq("status", "failed")
    .select("id");
  if (error) throw error;
  return (data ?? []).length;
}
