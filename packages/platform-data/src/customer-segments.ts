import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingTableOrSchemaError } from "./supabase-errors.js";

export type SegmentRuleType =
  | "spend_above"
  | "spend_below"
  | "order_count_above"
  | "inactive_days"
  | "product_category"
  | "tier"
  | "manual";

export type Segment = {
  id: string;
  name: string;
  description: string | null;
  rule_type: SegmentRuleType;
  rule_config: Record<string, unknown>;
  auto_refresh: boolean;
  member_count: number;
  last_refreshed_at: string | null;
  created_at: string;
  organization_id: string | null;
};

function rowToSegment(row: Record<string, unknown>): Segment {
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    description: row.description != null ? String(row.description) : null,
    rule_type: (row.rule_type as SegmentRuleType) ?? "manual",
    rule_config: (row.rule_config as Record<string, unknown>) ?? {},
    auto_refresh: Boolean(row.auto_refresh ?? true),
    member_count: Number(row.member_count ?? 0),
    last_refreshed_at:
      row.last_refreshed_at != null ? String(row.last_refreshed_at) : null,
    created_at: String(row.created_at ?? new Date().toISOString()),
    organization_id: row.organization_id != null ? String(row.organization_id) : null,
  };
}

export async function listSegments(
  supabase: SupabaseClient,
  organizationId?: string,
): Promise<Segment[]> {
  let query = supabase
    .from("customer_segments")
    .select("*")
    .order("name");
  if (organizationId) query = query.eq("organization_id", organizationId);
  const { data, error } = await query;
  if (error) {
    if (isMissingTableOrSchemaError(error)) return [];
    throw error;
  }
  return (data ?? []).map((r) => rowToSegment(r as Record<string, unknown>));
}

export async function createSegment(
  supabase: SupabaseClient,
  input: {
    name: string;
    description?: string;
    rule_type: SegmentRuleType;
    rule_config?: Record<string, unknown>;
    auto_refresh?: boolean;
    organization_id: string;
  },
): Promise<Segment> {
  const { data, error } = await supabase
    .from("customer_segments")
    .insert({
      name: input.name,
      description: input.description ?? null,
      rule_type: input.rule_type,
      rule_config: input.rule_config ?? {},
      auto_refresh: input.auto_refresh ?? true,
      organization_id: input.organization_id,
    })
    .select("*")
    .single();
  if (error) throw error;
  return rowToSegment(data as Record<string, unknown>);
}

export async function addSegmentMembers(
  supabase: SupabaseClient,
  segmentId: string,
  organizationId: string,
  members: Array<{ customer_email: string; medusa_customer_id?: string }>,
): Promise<number> {
  if (members.length === 0) return 0;
  const rows = members.map((m) => ({
    segment_id: segmentId,
    customer_email: m.customer_email,
    medusa_customer_id: m.medusa_customer_id ?? null,
  }));
  const { error } = await supabase
    .from("customer_segment_members")
    .upsert(rows.map((row) => ({ ...row, organization_id: organizationId })), {
      onConflict: "segment_id,customer_email",
    });
  if (error) throw error;

  const { count } = await supabase
    .from("customer_segment_members")
    .select("*", { count: "exact", head: true })
    .eq("segment_id", segmentId)
    .eq("organization_id", organizationId);

  await supabase
    .from("customer_segments")
    .update({
      member_count: count ?? members.length,
      last_refreshed_at: new Date().toISOString(),
    })
    .eq("id", segmentId)
    .eq("organization_id", organizationId);

  return count ?? members.length;
}

export async function getSegmentMembers(
  supabase: SupabaseClient,
  segmentId: string,
  organizationId?: string,
): Promise<Array<{ customer_email: string; medusa_customer_id: string | null }>> {
  let query = supabase
    .from("customer_segment_members")
    .select("customer_email, medusa_customer_id")
    .eq("segment_id", segmentId);
  if (organizationId) query = query.eq("organization_id", organizationId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((r) => ({
    customer_email: String(r.customer_email),
    medusa_customer_id:
      r.medusa_customer_id != null ? String(r.medusa_customer_id) : null,
  }));
}

export async function deleteSegment(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await supabase
    .from("customer_segments")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
