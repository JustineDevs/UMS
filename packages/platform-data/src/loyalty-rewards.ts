import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingTableOrSchemaError } from "./supabase-errors.js";

export type RewardType = "discount" | "free_item" | "free_shipping" | "custom";

export type LoyaltyReward = {
  id: string;
  name: string;
  description: string | null;
  points_cost: number;
  reward_type: RewardType;
  reward_value: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
};

function rowToReward(row: Record<string, unknown>): LoyaltyReward {
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    description: row.description != null ? String(row.description) : null,
    points_cost: Number(row.points_cost ?? 0),
    reward_type: (row.reward_type as RewardType) ?? "discount",
    reward_value: (row.reward_value as Record<string, unknown>) ?? {},
    is_active: Boolean(row.is_active ?? true),
    created_at: String(row.created_at ?? new Date().toISOString()),
  };
}

export async function listRewards(
  supabase: SupabaseClient,
  opts?: { activeOnly?: boolean },
): Promise<LoyaltyReward[]> {
  let q = supabase.from("loyalty_rewards").select("*").order("points_cost");
  if (opts?.activeOnly) {
    q = q.eq("is_active", true);
  }
  const { data, error } = await q;
  if (error) {
    if (isMissingTableOrSchemaError(error)) return [];
    throw error;
  }
  return (data ?? []).map((r) => rowToReward(r as Record<string, unknown>));
}

export async function createReward(
  supabase: SupabaseClient,
  input: {
    name: string;
    description?: string;
    points_cost: number;
    reward_type?: RewardType;
    reward_value?: Record<string, unknown>;
  },
): Promise<LoyaltyReward> {
  const { data, error } = await supabase
    .from("loyalty_rewards")
    .insert({
      name: input.name,
      description: input.description ?? null,
      points_cost: input.points_cost,
      reward_type: input.reward_type ?? "discount",
      reward_value: input.reward_value ?? {},
    })
    .select("*")
    .single();
  if (error) throw error;
  return rowToReward(data as Record<string, unknown>);
}

export async function updateReward(
  supabase: SupabaseClient,
  id: string,
  patch: Partial<{
    name: string;
    description: string;
    points_cost: number;
    reward_type: RewardType;
    reward_value: Record<string, unknown>;
    is_active: boolean;
  }>,
): Promise<LoyaltyReward> {
  const { data, error } = await supabase
    .from("loyalty_rewards")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return rowToReward(data as Record<string, unknown>);
}
