import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingTableOrSchemaError } from "./supabase-errors.js";

export type ReasonRegistryKind = "return" | "refund";

export type ReasonRegistryRow = {
  id: string;
  kind: ReasonRegistryKind;
  code: string;
  label: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

function rowToReasonRegistry(row: Record<string, unknown>): ReasonRegistryRow {
  return {
    id: String(row.id ?? ""),
    kind: (row.kind as ReasonRegistryKind) ?? "return",
    code: String(row.code ?? ""),
    label: String(row.label ?? ""),
    description: row.description != null ? String(row.description) : null,
    is_active: Boolean(row.is_active ?? true),
    sort_order: Number(row.sort_order ?? 0),
    created_at: String(row.created_at ?? new Date().toISOString()),
    updated_at: String(row.updated_at ?? new Date().toISOString()),
  };
}

export async function listReasonRegistry(
  supabase: SupabaseClient,
  opts?: { kind?: ReasonRegistryKind; activeOnly?: boolean },
): Promise<ReasonRegistryRow[]> {
  let q = supabase
    .from("return_refund_reasons")
    .select("*")
    .order("kind")
    .order("sort_order")
    .order("label");

  if (opts?.kind) {
    q = q.eq("kind", opts.kind);
  }
  if (opts?.activeOnly) {
    q = q.eq("is_active", true);
  }

  const { data, error } = await q;
  if (error) {
    if (isMissingTableOrSchemaError(error)) return [];
    throw error;
  }
  return (data ?? []).map((row) => rowToReasonRegistry(row as Record<string, unknown>));
}

export async function upsertReasonRegistry(
  supabase: SupabaseClient,
  input: {
    id?: string;
    kind: ReasonRegistryKind;
    code: string;
    label: string;
    description?: string | null;
    is_active?: boolean;
    sort_order?: number;
  },
): Promise<ReasonRegistryRow> {
  const payload = {
    kind: input.kind,
    code: input.code,
    label: input.label,
    description: input.description ?? null,
    is_active: input.is_active ?? true,
    sort_order: input.sort_order ?? 0,
    updated_at: new Date().toISOString(),
  };

  const query = input.id
    ? supabase.from("return_refund_reasons").update(payload).eq("id", input.id)
    : supabase.from("return_refund_reasons").upsert(payload, { onConflict: "kind,code" });

  const { data, error } = await query.select("*").single();
  if (error) throw error;
  return rowToReasonRegistry(data as Record<string, unknown>);
}

export async function deleteReasonRegistry(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await supabase.from("return_refund_reasons").delete().eq("id", id);
  if (error) throw error;
}
